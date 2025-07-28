import * as core from '@actions/core'
import { ToolRunner } from '@actions/exec/lib/toolrunner'
import * as io from '@actions/io'
import * as cache from '@actions/cache'
import * as path from 'path'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'

const upToolname = 'up'

async function run(): Promise<void> {
  try {
    const upPath = await getUpPath()

    // NOTE (markanderstrocme): allowing skipping login check if people are using their own container registry
    const skipLoginCheck = core.getInput('skip-login-check', { required: true })
    if (skipLoginCheck.toLowerCase() === 'true') {
      core.info('Skipping login check.')
    } else {
      const isLoggedIn = await verifyLogin(upPath)
      if (!isLoggedIn) {
        core.setFailed('User is not logged in. Please log in to Upbound.')
        return
      }
    }

    const projectFile = core.getInput('project-file')
    const repository = core.getInput('repository')
    const tag = core.getInput('tag')
    const publicVisibility = core.getInput('public')
    const cwd = core.getInput('cwd')
    const cacheSchemaFolders = core.getInput('cache-schema-folders')

    // Handle caching
    const workingDir = cwd !== '' ? cwd : process.cwd()
    const upCacheDir = path.join(workingDir, '.up')
    const homeDir = os.homedir()
    const upHomeCacheDir = path.join(homeDir, '.up', 'cache')
    const upHomeBuildCacheDir = path.join(homeDir, '.up', 'build-cache')

    if (cacheSchemaFolders.toLowerCase() === 'true') {
      await handleCacheRestore(
        [upCacheDir, upHomeCacheDir, upHomeBuildCacheDir],
        workingDir
      )
    }

    const upProjectBuildArgs = ['project', 'build']
    if (projectFile && projectFile.trim().length > 0) {
      upProjectBuildArgs.push('--project-file', projectFile)
    }
    if (repository && repository.trim().length > 0) {
      upProjectBuildArgs.push('--repository', repository)
    }

    const upProjectBuild = new ToolRunner(upPath, upProjectBuildArgs, {
      cwd: cwd !== '' ? cwd : undefined
    })
    await upProjectBuild.exec()

    const pushProject = core.getInput('push-project', { required: true })
    if (pushProject.toLowerCase() !== 'true') {
      core.info('Skipping up project push')
      return
    }

    const upProjectPushArgs = ['project', 'push']
    if (projectFile && projectFile.trim().length > 0) {
      upProjectPushArgs.push('--project-file', projectFile)
    }
    if (repository && repository.trim().length > 0) {
      upProjectPushArgs.push('--repository', repository)
    }
    if (tag && tag.trim().length > 0) {
      upProjectPushArgs.push('--tag', tag)
    }
    if (publicVisibility.toLowerCase() === 'true') {
      upProjectPushArgs.push('--public')
    }

    const upProjectPush = new ToolRunner(upPath, upProjectPushArgs, {
      cwd: cwd !== '' ? cwd : undefined
    })
    await upProjectPush.exec()

    // Save cache after successful build/push
    if (cacheSchemaFolders.toLowerCase() === 'true') {
      await handleCacheSave(
        [upCacheDir, upHomeCacheDir, upHomeBuildCacheDir],
        workingDir
      )
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function verifyLogin(upPath: string): Promise<boolean> {
  try {
    let output = ''
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let errorOutput = ''

    const upOrgList = new ToolRunner(
      upPath,
      ['org', 'list', '--format', 'json'],
      {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString()
          },
          stderr: (data: Buffer) => {
            errorOutput += data.toString()
          }
        }
      }
    )

    await upOrgList.exec()

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const orgList = JSON.parse(output)

    if (Array.isArray(orgList) && orgList.length > 0) {
      core.debug('User is logged in.')
      return true
    } else {
      core.warning('User is not logged in. No organizations found.')
      return false
    }
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`User is not logged in. Unauthorized error detected.`)
      return false
    }
    core.warning('Something went wrong.')
    return false
  }
}

async function getUpPath(): Promise<string> {
  const upPath = await io.which(upToolname, false)
  if (!upPath)
    throw Error('up not found, you can install it using upbound/action-up')

  return upPath
}

async function handleCacheRestore(
  cacheDirs: string[],
  workingDir: string
): Promise<void> {
  try {
    const cacheKey = generateCacheKey(workingDir)

    core.info(`Attempting to restore cache with key: ${cacheKey}`)

    const cacheHit = await cache.restoreCache(cacheDirs, cacheKey)

    if (cacheHit) {
      core.info(`Cache restored from key: ${cacheHit}`)
    } else {
      core.info('No cache found, starting fresh build')
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('upbound.yaml not found')
    ) {
      core.info(
        'Skipping cache restore: upbound.yaml not found in repository root'
      )
    } else {
      core.warning(
        `Cache restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}

async function handleCacheSave(
  cacheDirs: string[],
  workingDir: string
): Promise<void> {
  try {
    const cacheKey = generateCacheKey(workingDir)

    core.info(`Attempting to save cache with key: ${cacheKey}`)

    const cacheId = await cache.saveCache(cacheDirs, cacheKey)

    if (cacheId !== -1) {
      core.info(`Cache saved with ID: ${cacheId}`)
    } else {
      core.info('Cache already exists, skipping save')
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('upbound.yaml not found')
    ) {
      core.info(
        'Skipping cache save: upbound.yaml not found in repository root'
      )
    } else {
      core.warning(
        `Cache save failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}

function generateCacheKey(workingDir: string): string {
  const baseKey = 'up-cache-v2'
  const runnerOS = process.env.RUNNER_OS || 'unknown'

  // Hash the upbound.yaml file for content-based caching
  const upboundPath = path.join(workingDir, 'upbound.yaml')

  if (!fs.existsSync(upboundPath)) {
    throw new Error('upbound.yaml not found in repository root')
  }

  const upboundContent = fs.readFileSync(upboundPath, 'utf8')
  const upboundHash = crypto
    .createHash('sha256')
    .update(upboundContent)
    .digest('hex')
    .substring(0, 16)

  return `${baseKey}-${runnerOS}-${upboundHash}`
}

export { run, verifyLogin, getUpPath, handleCacheRestore, handleCacheSave }
