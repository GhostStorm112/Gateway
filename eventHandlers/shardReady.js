const EventHandler = require('../structures/EventHandler')
class TestHandler extends EventHandler {
  get name () {
    return 'test'
  }

  get canHandle () {
    return ['TEST']
  }

  async handle (event) {
  }
}

module.exports = TestHandler

class ShardReadyHandler extends EventHandler {
  get name () {
    return 'ShardReady'
  }

  get canHandle () {
    return ['SHARD_READY']
  }

  async handle (event) {
    this.bot.shardStatusUpdate(event.id, { status: 'online', game: { name: `Shard: ${event.id} || ==help`, type: 0 } })
    this.log.info('Gateway', 'Shard: ' + event.id + ' joined the hive')
    this.log.debug('E-SHARD_READY', `Starting recover for ${event.id}`)
    this.workerConnector.sendToQueue({
      t: 'LAVALINK_RECOVER',
      d: {
        shard_amount: 1,
        gateway: this.gateway.id,
        shard: event.id
      }
    })
  }
}

module.exports = ShardReadyHandler
