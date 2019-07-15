const path = require('path')
const fs = require('fs')
const async = require('async')
const request = require('superagent')
const cheerio = require('cheerio')

const BI_QU_GE = {
  URLS: {
    CHAPTER: 'https://www.biquke.com/bq/0/990/' // 凡人修仙传仙界篇
    // CHAPTER: 'https://www.biquguan.com/bqg447042/' // 爱情公寓
  },
  HANDLERS: {
    chapterHandle: (htmlStr) => {
      let _$ = cheerio.load(htmlStr)
      let list = _$('#list dd')
      let chapters = []
      list.each((index, item) => {
        // FIXME: filter latest part
        let _item = _$(item)
        let href = _item.find('a').attr('href')
        if (href) {
          chapters.push({
            index: index - 2,
            url: `${BI_QU_GE.URLS.CHAPTER}${href}`,
            name: _item.text()
          })
        }
      })
      return chapters
    },
    chapterContentHandler: (htmlStr) => {
      let $ = cheerio.load(htmlStr)
      let content = $('#content').text()
      content = content.replace(/\s{4}/g, '\r\n    ')
      return content
    }
  }
}

function getChapter (start = 0, end) {
  return new Promise((resolve, reject) => {
    request
      .get(BI_QU_GE.URLS.CHAPTER)
      .end((err, res) => {
        if (err) {
          reject(err)
          throw err
        }
        let chapters = BI_QU_GE.HANDLERS.chapterHandle(res.text)
        chapters = chapters.slice(start)
        if (end) {
          chapters = chapters.slice(0, end)
        }
        resolve(chapters)
      })
  })
}

function getChapterContent (url) {
  return new Promise((resolve, reject) => {
    request
      .get(url)
      .end((err, res) => {
        if (err) {
          reject(err)
          throw err
        }
        let content = BI_QU_GE.HANDLERS.chapterContentHandler(res.text)
        resolve(content)
      })
  })
}


async function main () {
  const maxLimit = 5
  let completeCount = 0
  let totalChapter = 0
  let chapters = []
  try {
    chapters = await getChapter()
  } catch (err) {
    console.log(err)
  }
  totalChapter = chapters.length
  if (totalChapter === 0) {
    console.log('There is no new chapter')
    return
  }
  async.mapLimit(chapters, maxLimit, async item => {
    let content = await getChapterContent(item.url)
    console.log(`finished ${++completeCount} / ${totalChapter} ${item.name}`)
    return {
      ...item,
      content
    }
  }, (err, results) => {
    if (err) {
      throw err
    }
    console.log(totalChapter, results.length)
    let content = ''
    results.map(_ => {
      // FIXME: use format plugin
      content += `${_.name}\r\n${_.content}`
    })
    fs.writeFileSync(path.resolve(__dirname, '爱情公寓.txt'), content)
    console.log('gen book complete')
  })
}

main()
