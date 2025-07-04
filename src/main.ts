import * as core from '@actions/core'
import { ToolRunner } from '@actions/exec/lib/toolrunner'
import * as io from '@actions/io'

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

export { run, verifyLogin, getUpPath }
