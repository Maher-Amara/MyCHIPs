//Visual trading variable report generator
//Copyright MyCHIPs.org; See license in root of this package
// ----------------------------------------------------------------------------
//TODO:
//- 
const { log, buildContent, staticFile, errCode } = require('./common')
const Path = require('path')

// ----------------------------------------------------------------------------
function trade(info, cb, resource) {		//Build a graph of trading variables
  let {data, view, origin, resPath, message, db, cache} = info
    , {keys, options} = (data ? data : {})
    , key = ((keys && keys[0]) ? keys[0] : {})
    , error, content
  if (!cache) cache = {}
log.debug('Calling trade:', JSON.stringify(data), resPath)

  if (resource == 'trade.html') {
    return staticFile(Path.join(__dirname, resource), cache.graphHTML, (err, cont) => {
//      cb(err, cache.graphHTML = cont)
      cb(err, cont)	//DEBUG
    })

  } else if (resource == 'user.json') {
//log.debug('Fetch:', resource, key)		;cache.graphJSON=null	//DEBUG
    let fields = 'id, std_name, peer_cid, peer_agent, asset, assets, liab, liabs, net, latest, tallies'
      , sql = `select ${fields} from mychips.users_v_tallies_me`
    db.query(sql, (err, res) => {
log.debug('  err:', err, ' res:', res, 'rows:', res?.rows ? res.rows[0] : null)
      let row = res?.rows?.[0]
      cb(err, row, keys, options)
    })
    return false
  } else if (resource) {
    cb(new Error('Unknown resource'))
    return false
  }

  let makeContent = function(format) {
    let link = origin + resPath + '/trade.html'
    switch (format) {
      case 'url':
        return link
      default:
        return `
          <div>${message('trade').title}</div>
          <div style="height:100%; margin: 0;">
            <iframe src="${link}" style="width:100%; height:96%; border: 1px solid #808080;">
            </iframe>
          </div>
        `
    }
  }

log.debug('Res:', resource, 'Fmt:', options?.format)
  content = buildContent(options?.format, makeContent)
  cb(error, content)
  return (!error)
}

module.exports = {
  'mychips.tallies_v_me': {trade}
}