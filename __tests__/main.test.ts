import * as core from '@actions/core'
import * as io from '@actions/io'
import { ToolRunner } from '@actions/exec/lib/toolrunner'
import * as run from '../src/main'

let debugMock: jest.SpiedFunction<typeof core.debug>
let errorMock: jest.SpiedFunction<typeof core.error>
let infoMock: jest.SpiedFunction<typeof core.info>
let warningMock: jest.SpiedFunction<typeof core.warning>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
let getInputMock: jest.SpiedFunction<typeof core.getInput>

const whichMock = jest.spyOn(io, 'which')

let mockStatusCode: number
let stdOutMessage: string | undefined
let stdErrMessage: string | undefined

const mockExecFn = jest.fn().mockImplementation((toolPath, args, options) => {
  if (options?.listeners?.stdout) {
    options.listeners.stdout(Buffer.from(stdOutMessage || '', 'utf8'))
  }
  if (options?.listeners?.stderr) {
    options.listeners.stderr(Buffer.from(stdErrMessage || '', 'utf8'))
  }
  return Promise.resolve(mockStatusCode)
})
jest.mock('@actions/exec/lib/toolrunner', () => {
  return {
    ToolRunner: jest.fn().mockImplementation((toolPath, args, options) => {
      return {
        exec: () => mockExecFn(toolPath, args, options)
      }
    })
  }
})

const path = '/path/to/up'

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockStatusCode = 0
    stdOutMessage = undefined
    stdErrMessage = undefined

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    infoMock = jest.spyOn(core, 'info').mockImplementation()
    warningMock = jest.spyOn(core, 'warning').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
  })

  describe('getUpPath', () => {
    it('returns the path to the up executable if found', async () => {
      whichMock.mockResolvedValue(path)

      const upPath = await run.getUpPath()

      expect(whichMock).toHaveBeenCalledWith('up', false)
      expect(upPath).toBe(path)
    })

    it('throws an error if the up executable is not found', async () => {
      whichMock.mockResolvedValue('')

      await expect(run.getUpPath()).rejects.toThrow(
        'up not found, you can install it using upbound/action-up'
      )
    })
  })

  describe('verifyLogin', () => {
    it('returns true if user is logged in', async () => {
      stdOutMessage = JSON.stringify([{ id: 1, name: 'test-org' }])
      mockStatusCode = 0

      const isLoggedIn = await run.verifyLogin(path)
      expect(isLoggedIn).toBe(true)
      expect(mockExecFn).toHaveBeenCalledWith(
        path,
        ['org', 'list', '--format', 'json'],
        expect.any(Object)
      )
    })

    it('returns false if user is not logged in', async () => {
      stdErrMessage = 'Unauthorized'
      mockStatusCode = 1

      const isLoggedIn = await run.verifyLogin(path)
      expect(isLoggedIn).toBe(false)
      expect(mockExecFn).toHaveBeenCalledWith(
        path,
        ['org', 'list', '--format', 'json'],
        expect.any(Object)
      )
    })
  })
})
