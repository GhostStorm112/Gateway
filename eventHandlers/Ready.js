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

    /* setInterval(
      async () => {
        this.workerConnector.sendToQueue({ d:
          { guild_id: '268807882059939840',
            attachments: [],
            author:
             { avatar: 'f37ad54f3bd57c5848be2c14945c281a',
               discriminator: '3460',
               id: '167927608191746048',
               username: '112' },
            channel_id: '268807882059939840',
            content: '==test',
            edited_timestamp: null,
            embeds: [],
            id: '511538271197855762',
            member:
             { deaf: false,
               joined_at: '2017-01-11T18:26:33.296000+00:00',
               mute: false,
               nick: null,
               roles:
                [ '326614203735474176',
                  '269363212753829889',
                  '411062456518180865',
                  '455994222122631169' ] },
            mention_everyone: false,
            mention_roles: [],
            mentions: [],
            nonce: '511538270295818240',
            pinned: false,
            timestamp: '2018-11-12T13:50:27.775000+00:00',
            tts: false,
            type: 0 },
        op: 0,
        s: 5,
        t: 'MESSAGE_CREATE',
        shard_id: 0 }
        )
      }, 100
    ) */
  }
}

module.exports = ReadyEventHandler
