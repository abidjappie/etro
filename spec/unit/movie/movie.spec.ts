import etro from '../../../src/index'
import { mockAudioContext, mockCanvas, mockMediaRecorder, mockTime, patchMediaRecorder } from '../mocks/dom'
import { mockBaseEffect } from '../mocks/effect'
import { mockBaseLayer } from '../mocks/layer'

describe('Unit Tests ->', function () {
  describe('Movie', function () {
    let movie
    let mediaRecorder: MediaRecorder

    beforeEach(function () {
      // Mock MediaRecorder constructor
      mediaRecorder = mockMediaRecorder()
      patchMediaRecorder(window, mediaRecorder)

      movie = new etro.Movie({
        actx: mockAudioContext(),
        canvas: mockCanvas()
      })
      movie.addLayer(mockBaseLayer())
    })

    describe('identity ->', function () {
      it("should be of type 'movie'", function () {
        expect(movie.type).toBe('movie')
      })
    })

    describe('layers ->', function () {
      it('should call start when playing', async function () {
        // 1a. Force currentTime to 0
        mockTime(0)

        // 1b. Layer must be inactive to start
        const layer = movie.layers[0]
        layer.active = false

        // 2. Play one frame at the beginning of the movie
        await movie.play()

        // 3. Make sure start was called
        expect(layer.start).toHaveBeenCalledTimes(1)
      })

      it('should not call start when refreshing', async function () {
        // 1a. Force currentTime to 0
        mockTime(0)

        // 1b. Layer must be inactive to start
        const layer = movie.layers[0]
        layer.active = false

        // 2. Play one frame at the beginning of the movie
        await movie.refresh()

        // 3. Make sure start was called
        expect(layer.start).toHaveBeenCalledTimes(0)
      })

      it('should call `seek` on the layer when seeking', function () {
        // 1. Seek to 1 second
        movie.seek(1)

        // 2. Make sure `seek` was called
        const layer = movie.layers[0]
        expect(layer.seek).toHaveBeenCalledWith(1)
      })

      it('should call `progress` on the layer during playback', async function () {
        // Mock time
        mockTime(0)

        // Play the movie
        await movie.play()

        // Make sure `progress` was called at least once
        const layer = movie.layers[0]
        expect(layer.progress).toHaveBeenCalled()
      })

      it('should call stop when done playing', async function () {
        // 1a. Force currentTime to be at the end of the movie (currentTime >
        // duration)
        mockTime(2000)

        // 1b. Layer must be active to stop
        const layer = movie.layers[0]
        layer.active = true

        // 2. Play one frame at the end of the movie
        await movie.play()

        // 3. Make sure stop was called
        expect(layer.stop).toHaveBeenCalledTimes(1)
      })

      it('should not call stop when refreshing at end of movie', async function () {
        // 1a. Force currentTime to be at the end of the movie (currentTime >
        // duration)
        mockTime(2000)

        // 1b. Layer must be active to stop
        const layer = movie.layers[0]
        layer.active = true

        // 2. Play one frame at the end of the movie
        await movie.refresh()

        // 3. Make sure stop was called
        expect(layer.stop).toHaveBeenCalledTimes(0)
      })

      it('should call start then stop when recording through', async function () {
        // 1. Record the first 0.1 seconds of the movie
        await movie.record({ frameRate: 10, duration: 0.1 })

        // 2. Make sure neither start or stop were called
        const layer = movie.layers[0]
        expect(layer.start).toHaveBeenCalledTimes(1)
        expect(layer.stop).toHaveBeenCalledTimes(1)
      })

      it('should not start or stop layers when refreshing', async function () {
        // 1. Call refresh on movie
        await movie.refresh()

        // 2. Make sure neither start or stop were called
        const layer = movie.layers[0]
        expect(layer.start).toHaveBeenCalledTimes(0)
        expect(layer.stop).toHaveBeenCalledTimes(0)
      })

      it('should call user provided `onDraw` after drawing', async function () {
        // 1a. Force currentTime to 0
        mockTime(0)

        // 1b. Layer must be inactive to start
        const layer = movie.layers[0]
        layer.active = false

        // 2a. Prepare options object with onDraw callback
        const options = jasmine.createSpyObj('options', ['onDraw'])

        // 2. Play one frame at the beginning of the movie with the spy options
        await movie.play(options)

        // 3. Make sure onDraw was called
        expect(options.onDraw).toHaveBeenCalledTimes(1)
      })

      it('should be able to operate after a layer has been deleted', async function () {
        mockTime()

        // Start with three layers
        for (let i = 0; i < 3; i++) {
          movie.addLayer(mockBaseLayer())
        }

        // Delete the middle layer
        delete movie.layers[1]

        // Let the movie play and pause it again
        await movie.play({
          onStart: () => {
            expect(movie.paused).toBe(false)
            movie.pause()
            expect(movie.paused).toBe(true)
          }
        })
      })
    })

    describe('playback ->', function () {
      class TimeMonitor extends etro.effect.Base {
        constructor (
          public readonly minTime: number,
          public readonly maxTime: number
        ) {
          super()
        }

        render (): void {
          expect(this.currentTime).toBeGreaterThanOrEqual(this.minTime)
          expect(this.currentTime).toBeLessThanOrEqual(this.maxTime)
        }
      }

      it('should be ready when all its children are', function () {
        // Remove all layers and effects
        movie.layers.length = 0
        movie.effects.length = 0

        // Add a layer that is ready
        const layer = mockBaseLayer()
        layer.ready = true
        movie.layers.push(layer)

        // Add an effect that is ready
        const effect = mockBaseEffect()
        effect.ready = true
        movie.effects.push(effect)

        // Make sure the movie is ready
        expect(movie.ready).toBe(true)
      })

      it('should not be ready when one of its layers is not', function () {
        // Remove all layers and effects
        movie.layers.length = 0
        movie.effects.length = 0

        // Add a layer that is not ready
        const layer = mockBaseLayer()
        layer.ready = false
        movie.layers.push(layer)

        // Add an effect that is ready
        const effect = mockBaseEffect()
        effect.ready = true
        movie.effects.push(effect)

        // Make sure the movie is not ready
        expect(movie.ready).toBe(false)
      })

      it('should not be ready when one of its effects is not', function () {
        // Remove all layers and effects
        movie.layers.length = 0
        movie.effects.length = 0

        // Add a layer that is ready
        const layer = mockBaseLayer()
        layer.ready = true
        movie.layers.push(layer)

        // Add an effect that is not ready
        const effect = mockBaseEffect()
        effect.ready = false
        movie.effects.push(effect)

        // Make sure the movie is not ready
        expect(movie.ready).toBe(false)
      })

      it('should not be paused while playing', async function () {
        mockTime()
        await movie.play({
          onStart: () => {
            expect(movie.paused).toBe(false)
          }
        })
      })

      it('should be paused after pausing', async function () {
        mockTime()
        await movie.play({
          onStart: () => {
            movie.pause()
            // No promise returned by `pause`, because code is async in implementation.
            expect(movie.paused).toBe(true)
          }
        })
      })

      it('should be paused after stopping', async function () {
        mockTime()

        await movie.play({
          onStart: () => {
            // Stop the movie
            movie.stop()
            // Make sure the movie is paused
            expect(movie.paused).toBe(true)
          }
        })
      })

      it('should be paused after playing to the end', async function () {
        mockTime()
        await movie.play()
        expect(movie.paused).toBe(true)
      })

      it('should be reset to beginning after stopping', async function () {
        mockTime()

        await movie.play({
          onStart: () => {
            // Stop the movie
            movie.stop()
            expect(movie.currentTime).toBe(0)
          }
        })
      })

      it('should have an active stream while streaming', async function () {
        mockTime()

        await movie.stream({
          frameRate: 10,
          onStart (stream: MediaStream) {
            expect(stream).not.toBeNull()
          }
        })
      })

      it('should stop streaming at the right time when `duration` is provided', async function () {
        mockTime(0, 300)
        movie.effects.push(new TimeMonitor(0, 0.4))

        await movie.stream({
          frameRate: 10,
          duration: 0.4,
          onStart (_stream: MediaStream) {}
        })
      })

      it('should be `recording` when recording', async function () {
        mockTime()

        await movie.record({
          frameRate: 10,
          onStart: () => {
            expect(movie.recording).toBe(true)
          }
        })
      })

      it('should not be paused when recording', async function () {
        mockTime()

        await movie.record({
          frameRate: 10,
          onStart: () => {
            expect(movie.paused).toBe(false)
          }
        })
      })

      it('should be paused after recording to the end', async function () {
        mockTime()
        await movie.record({ frameRate: 10 })
        expect(movie.paused).toBe(true)
      })

      it('should end recording at the right time when `duration` is supplied', async function () {
        mockTime(0, 300)
        movie.effects.push(new TimeMonitor(0, 0.4))
        await movie.record({ frameRate: 10, duration: 0.4 })
      })

      it('should reach the end when recording with no `duration`', async function () {
        await movie.record({ frameRate: 10 })
      })

      it('should pause recording when no longer ready', async function () {
        // Start out ready
        let ready = true

        // Mock the `ready` property on the movie
        Object.defineProperty(movie, 'ready', {
          get () {
            return ready
          }
        })

        // Buffer for a second
        setTimeout(() => {
          ready = false
        }, 100)
        setTimeout(() => {
          ready = true
        }, 1100)

        // Record entire movie
        await movie.record({ frameRate: 10 })

        // Make sure the movie was paused while buffering
        expect(mediaRecorder.pause).toHaveBeenCalled()

        // Make sure the movie was resumed when done buffering
        expect(mediaRecorder.resume).toHaveBeenCalled()
      })

      it('should be able to play and pause after an effect has been directly deleted', async function () {
        mockTime()

        // Start with one effect
        movie.effects.push(mockBaseEffect())

        // Delete the effect
        delete movie.effects[0]

        // Start playing
        await movie.play({
          onStart: () => {
            expect(movie.paused).toBe(false)

            // Pause the movie
            movie.pause()
            expect(movie.paused).toBe(true)
          }
        })
      })
    })
  })
})
