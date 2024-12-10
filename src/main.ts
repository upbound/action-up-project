import * as core from '@actions/core'
import { ToolRunner } from '@actions/exec/lib/toolrunner'
import * as io from '@actions/io'

const upToolname = 'up'

export async function run(): Promise<void> {
  try {
    const upPath = await getUpPath()

    const upProjectBuild = new ToolRunner(upPath, ['project', 'build'])
    await upProjectBuild.exec()

    const pushProject = core.getInput('push-project')
    if (pushProject.toLowerCase() === 'false') {
      core.info('Skipping up project push')
      return
    }

    const upProjectPush = new ToolRunner(upPath, ['project', 'push'])
    await upProjectPush.exec()
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export async function getUpPath() {
  const upPath = await io.which(upToolname, false)
  if (!upPath)
    throw Error('up not found, you can install it using upbound/action-up')

  return upPath
}
