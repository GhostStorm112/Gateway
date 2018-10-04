const RequestHandler = require('../structures/RequestHandler')
class VoiceStateUpdate extends RequestHandler {
  get name () {
    return 'VoiceStateUpdate'
  }

  get canHandle () {
    return ['VOICE_STATE_UPDATE']
  }

  async handle (event) {
    this.log.debug('H-VSU', `VSU for guild ${event.guild_id} `)
    this.bot.voiceStateUpdate(event.shard_id, event)
    const queue = await this.lavalink.queues.get(event.guild_id)
    await queue.player.join(event.channel_id)

    const players = await this.cache.storage.get('players', { type: 'arr' })
    let index
    if (Array.isArray(players)) index = players.findIndex(player => player.guild_id === event.guild_id)
    if (((!players && !index) || index < 0) && event.channel_id) {
      this.log.debug('H-VSU', `Adding player for ${event.guild_id} `)
      await this.cache.storage.upsert('players', [{ guild_id: event.guild_id, channel_id: event.channel_id }])
    } else if (players && typeof index !== 'undefined' && index >= 0 && !event.channel_id) {
      this.log.debug('H-VSU', `Removing player for ${event.guild_id} `)
      players.splice(index, 1)
      if (players.length === 0) await this.cache.storage.delete('players')
      else await this.cache.storage.set('players', players)
      queue.player.removeAllListeners()
    }
  }
}

module.exports = VoiceStateUpdate
