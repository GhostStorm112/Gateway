const EventHandler = require('../structures/EventHandler')
class ReadyEventHandler extends EventHandler {
  get name () {
    return 'Ready'
  }

  get canHandle () {
    return ['READY']
  }

  async handle (event) {
    this.log.info('Gateway', 'Connected to Discord gateway')
    this.workerConnector.sendToQueue({
      t: 'LAVALINK_RECOVER',
      d: {
        shard_amount: 1,
        gateway: this.gateway.id,
        shard: event.id
      }
    })
    setInterval(
      async () => {
        const shards = []
        for (const shard in this.bot.shardManager.shards) {
          shards[shard] = { shard_id: this.bot.shardManager.shards[shard].id, shard_status: this.bot.shardManager.shards[shard].connector.status, shard_event: this.bot.shardManager.shards[shard].connector.seq }
        }
        await this.cache.storage.set('shards', shards)
      }
      , 5000)
  }
}

module.exports = ReadyEventHandler
