const RequestHandler = require('../structures/RequestHandler')
class VoiceStateUpdate extends RequestHandler {
  get name () {
    return 'VoiceStateUpdate'
  }

  get canHandle () {
    return ['VOICE_STATE_UPDATE']
  }

  async handle (event) {
    const queue = await this.lavalink.queues.get(event.guild_id)

    await queue.player.join(event.channel_id)
    queue.player.on('error', console.error)

    const players = await this.redis.storage.get('players', { type: 'arr' })
    let index

    if (Array.isArray(players)) index = players.findIndex(player => player.guild_id === event.guild_id)
    if (((!players && !index) || index < 0) && event.channel_id) {
      await this.redis.storage.upsert('players', [{ guild_id: event.guild_id, channel_id: event.channel_id }])
    } else if (players && typeof index !== 'undefined' && index >= 0 && !event.channel_id) {
      players.splice(index, 1)
      if (players.length === 0) await this.redis.storage.delete('players')
      else await this.redis.storage.set('players', players)
      queue.player.removeAllListeners()
    }

    // await gvsu(redis, queue, event)
    // this.lavalink.voiceStateUpdate(event)
    this.bot.voiceStateUpdate(event.shard_id || 0, event)
  }
}

async function gvsu (redis, queue, packet) {

}

module.exports = VoiceStateUpdate
