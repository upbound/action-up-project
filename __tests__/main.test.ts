import * as io from '@actions/io'
import * as run from '../src/main'

const whichMock = jest.spyOn(io, 'which')

const path = '/path/to/up'

describe('action', () => {
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
})
