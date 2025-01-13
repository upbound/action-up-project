import * as io from '@actions/io'
import * as core from '@actions/core'
import * as run from '../src/main'
import { ExecOptions } from '@actions/exec/lib/interfaces'

const runMock = jest.spyOn(run, 'run')

let infoMock: jest.SpiedFunction<typeof core.info>
let debugMock: jest.SpiedFunction<typeof core.debug>
let warningMock: jest.SpiedFunction<typeof core.warning>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>

let mockStatusCode: number
let stdOutMessage: string | undefined
let stdErrMessage: string | undefined

const mockExecFn = jest
  .fn()
  .mockImplementation((toolPath, args, options: ExecOptions) => {
    if (options?.listeners?.stdout) {
      options.listeners.stdout(Buffer.from(stdOutMessage || '', 'utf8'))
    }
    if (options?.listeners?.stderr) {
      options.listeners.stderr(Buffer.from(stdErrMessage || '', 'utf8'))
    }
    return mockStatusCode
  })
jest.mock('@actions/exec/lib/toolrunner', () => {
  return {
    ToolRunner: jest.fn().mockImplementation((toolPath, args, options) => {
      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        exec: () => mockExecFn(toolPath, args, options)
      }
    })
  }
})

const path = '/path/to/up'

describe('action', () => {
  beforeEach(() => {
    infoMock = jest.spyOn(core, 'info').mockImplementation()
    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    warningMock = jest.spyOn(core, 'warning').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
  })

  it('fails if up is not found', async () => {
    jest.spyOn(io, 'which').mockResolvedValue('')

    await run.run()
    expect(runMock).toHaveReturned()

    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'up not found, you can install it using upbound/action-up'
    )
  })

  it('fails if your are not logged in', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'skip-login':
          return 'false'
        default:
          return ''
      }
    })
    jest.spyOn(io, 'which').mockResolvedValue(path)
    stdErrMessage = 'Unauthorized'
    mockStatusCode = 1

    await run.run()
    expect(runMock).toHaveReturned()

    expect(mockExecFn).toHaveBeenNthCalledWith(
      1,
      path,
      ['org', 'list', '--format', 'json'],
      expect.any(Object)
    )

    expect(warningMock).toHaveBeenNthCalledWith(
      1,
      'User is not logged in. Unauthorized error detected.'
    )
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'User is not logged in. Please log in to Upbound.'
    )
  })

  it('do not check login if skip-login', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'skip-login':
          return 'true'
        default:
          return ''
      }
    })
    jest.spyOn(io, 'which').mockResolvedValue(path)
    stdOutMessage = ''
    mockStatusCode = 0

    await run.run()
    expect(runMock).toHaveReturned()

    expect(mockExecFn).not.toHaveBeenNthCalledWith(
      1,
      path,
      ['org', 'list', '--format', 'json'],
      expect.any(Object)
    )

    expect(infoMock).toHaveBeenNthCalledWith(1, 'Skipping login check.')
  })

  it('does not push if push-project is false', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'push-project':
          return 'false'
        default:
          return ''
      }
    })

    jest.spyOn(io, 'which').mockResolvedValue(path)
    stdOutMessage = JSON.stringify([{ id: 1, name: 'test-org' }])
    mockStatusCode = 0

    await run.run()
    expect(runMock).toHaveReturned()

    expect(mockExecFn).toHaveBeenNthCalledWith(
      1,
      path,
      ['org', 'list', '--format', 'json'],
      expect.any(Object)
    )

    expect(mockExecFn).toHaveBeenNthCalledWith(
      2,
      path,
      ['project', 'build'],
      undefined
    )

    expect(debugMock).toHaveBeenNthCalledWith(1, 'User is logged in.')
    expect(infoMock).toHaveBeenNthCalledWith(1, 'Skipping up project push')
  })

  it('builds and pushes', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'push-project':
          return 'true'
        default:
          return ''
      }
    })

    jest.spyOn(io, 'which').mockResolvedValue(path)
    stdOutMessage = JSON.stringify([{ id: 1, name: 'test-org' }])
    mockStatusCode = 0

    await run.run()
    expect(runMock).toHaveReturned()

    expect(mockExecFn).toHaveBeenNthCalledWith(
      1,
      path,
      ['org', 'list', '--format', 'json'],
      expect.any(Object)
    )

    expect(mockExecFn).toHaveBeenNthCalledWith(
      2,
      path,
      ['project', 'build'],
      undefined
    )

    expect(mockExecFn).toHaveBeenNthCalledWith(
      3,
      path,
      ['project', 'push'],
      undefined
    )

    expect(debugMock).toHaveBeenNthCalledWith(1, 'User is logged in.')
  })

  it('builds and pushes with all flags', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'push-project':
          return 'true'
        case 'project-file':
          return 'test/upbound.yaml'
        case 'repository':
          return 'test-repo'
        case 'tag':
          return 'test-tag'
        case 'public':
          return 'true'
        default:
          return ''
      }
    })

    jest.spyOn(io, 'which').mockResolvedValue(path)
    stdOutMessage = JSON.stringify([{ id: 1, name: 'test-org' }])
    mockStatusCode = 0

    await run.run()
    expect(runMock).toHaveReturned()

    expect(mockExecFn).toHaveBeenNthCalledWith(
      1,
      path,
      ['org', 'list', '--format', 'json'],
      expect.any(Object)
    )

    expect(mockExecFn).toHaveBeenNthCalledWith(
      2,
      path,
      [
        'project',
        'build',
        '--project-file',
        'test/upbound.yaml',
        '--repository',
        'test-repo'
      ],
      undefined
    )

    expect(mockExecFn).toHaveBeenNthCalledWith(
      3,
      path,
      [
        'project',
        'push',
        '--project-file',
        'test/upbound.yaml',
        '--repository',
        'test-repo',
        '--tag',
        'test-tag',
        '--public'
      ],
      undefined
    )

    expect(debugMock).toHaveBeenNthCalledWith(1, 'User is logged in.')
  })
})
