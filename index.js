const path = require('path')
const fs = require('fs')
const async = require('async')
const request = require('superagent')
const cheerio = require('cheerio')
const nzhcn = require('nzh/cn')
// const indentString = require('indent-string')
// TODO: 下载 章节缓存优化
// TODO: 爬虫优化，1、cookie；2、请求头模拟；3、可选开启延迟抓取；4、IP？；5、超时重试

const BI_QU_GE = {
  URLS: {
    // CHAPTER: 'https://www.biquke.com/bq/0/990/' // 凡人修仙传仙界篇
    // CHAPTER: 'https://www.biquguan.com/bqg447042/' // 爱情公寓
    CHAPTER: 'https://www.biquke.com/bq/3/3714/' // 飞剑问道
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
    },
    ChineseNumber2Number (title) {
      const regx = /第(\S*?)章/
      let number = -1
      try {
        const ChineseNumber = title.match(regx)
        number = nzhcn.decodeS(ChineseNumber[1])
      } catch (err) {}
      return number
    }
  }
}

function getChapter (start = 0, end, splitBy = 'chapter') { // splitBy: chapter/index
  // TODO: 目前仅支持中文数字，且跟网址绑定了，需要抽离出来
  return new Promise((resolve, reject) => {
    request
      .get(BI_QU_GE.URLS.CHAPTER)
      .end((err, res) => {
        if (err) {
          reject(err)
          throw err
        }
        let chapters = BI_QU_GE.HANDLERS.chapterHandle(res.text)
        let startIndex = start
        let endIndex = end
        // 找到对应章节
        if (splitBy === 'chapter') {
          if (startIndex > 0) {
            startIndex = chapters.findIndex(_ => BI_QU_GE.HANDLERS.ChineseNumber2Number(_.name) === startIndex)
            if (startIndex === -1) {
              startIndex = start
            }
          }
          if (endIndex) {
            endIndex = chapters.findIndex(_ => BI_QU_GE.HANDLERS.ChineseNumber2Number(_.name) === endIndex)
            if (endIndex === -1) {
              endIndex = end
            }
          }
        }
        chapters = chapters.slice(startIndex)
        if (endIndex) {
          const diff = endIndex - startIndex
          chapters = chapters.slice(0, diff)
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
  const maxLimit = 40
  let completeCount = 0
  let totalChapter = 0
  let chapters = []
  const startChapter = 0
  const endChapter = null
  try {
    chapters = await getChapter(startChapter, endChapter)
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
      content += `${_.name}\r${_.content.trim()}\r`
    })
    fs.writeFileSync(path.resolve(__dirname, '飞剑问道.txt'), content)
    console.log('gen book complete')
  })
}

main()
