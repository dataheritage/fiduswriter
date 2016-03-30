import {render as katexRender} from "katex"

import {getMissingChapterData, getImageAndBibDB, uniqueObjects} from "./tools"
import {epubBookOpfTemplate, epubBookCoverTemplate, epubBookTitlepageTemplate,
  epubBookCopyrightTemplate} from "./epub-templates"
import {katexOpfIncludes} from "../../katex/opf-includes"

import {styleEpubFootnotes, getTimestamp, setLinks, orderLinks} from "../../exporter/epub"
import {cleanHTML, addFigureNumbers, replaceImgSrc} from "../../exporter/html"
import {ncxTemplate, ncxItemTemplate, navTemplate, navItemTemplate,
  containerTemplate, xhtmlTemplate} from "../../exporter/epub-templates"
import {node2Obj, obj2Node} from "../../exporter/json"
import {createSlug, findImages} from "../../exporter/tools"
import {zipFileCreator} from "../../exporter/zip"
import {formatCitations} from "../../citations/format"

export let downloadEpubBook = function (aBook, user, documentList) {
    getMissingChapterData(aBook, documentList, function () {
        getImageAndBibDB(aBook, documentList, function (anImageDB,
            aBibDB) {
            epubBookExport(aBook, anImageDB, aBibDB, user, documentList)
        })
    })
}

let templates = {ncxTemplate, ncxItemTemplate, navTemplate, navItemTemplate}

let epubBookExport = function (aBook, anImageDB, aBibDB, user, documentList) {
    let coverImage = false, contentItems = [],
        images = [],
        chapters = [],
        styleSheets = [],
        outputList = [],
        math = false

    aBook.chapters = _.sortBy(aBook.chapters, function (chapter) {
        return chapter.number
    })


    if (aBook.cover_image) {
        coverImage = _.findWhere(anImageDB, {
            pk: aBook.cover_image
        })
        images.push({
            url: coverImage.image.split('?')[0],
            filename: coverImage.image.split('/').pop().split('?')[0]
        })

        outputList.push({
            filename: 'EPUB/cover.xhtml',
            contents: epubBookCoverTemplate({aBook, coverImage})
        })
        contentItems.push({
            link: 'cover.xhtml#cover',
            title: gettext('Cover'),
            docNum: 0,
            id: 0,
            level: 0,
            subItems: [],
        })
    }
    contentItems.push({
        link: 'titlepage.xhtml#title',
        title: gettext('Title page'),
        docNum: 0,
        id: 1,
        level: 0,
        subItems: [],
    })




    for (let i = 0; i < aBook.chapters.length; i++) {

        let aChapter = {}

        aChapter.document = _.findWhere(documentList, {
            id: aBook.chapters[i].text
        })

        let tempNode = obj2Node(aChapter.document.contents)

        let contents = document.createElement('body')

        while (tempNode.firstChild) {
            contents.appendChild(tempNode.firstChild)
        }

        let bibliography = formatCitations(contents,
            aBook.settings.citationstyle,
            aBibDB)

        if (bibliography.length > 0) {
            contents.innerHTML += bibliography
        }

        images = images.concat(findImages(contents))

        let startHTML = '<h1 class="title">' + aChapter.document.title + '</h1>'

        if (aChapter.document.settings && aChapter.document.settings['metadata-subtitle'] && aChapter.document.metadata.subtitle) {
            tempNode = obj2Node(aChapter.document.metadata.subtitle)
            if (tempNode && tempNode.textContent.length > 0) {
                startHTML += '<h2 class="subtitle">' + tempNode.textContent +
                    '</h2>'
            }
        }
        if (aChapter.document.settings && aChapter.document.settings['metadata-abstract'] && aChapter.document.metadata.abstract) {
            tempNode = obj2Node(aChapter.document.metadata.abstract)
            if (tempNode && tempNode.textContent.length > 0) {
                startHTML += '<div class="abstract">' + tempNode.textContent +
                    '</div>'
            }
        }

        contents.innerHTML = startHTML + contents.innerHTML

        contents = cleanHTML(contents)

        contents = addFigureNumbers(contents)

        aChapter.number = aBook.chapters[i].number

        aChapter.part = aBook.chapters[i].part

        let equations = contents.querySelectorAll('.equation')

        let figureEquations = contents.querySelectorAll('.figure-equation')

        if (equations.length > 0 || figureEquations.length > 0) {
            aChapter.math = true
            math = true
        }

        for (let i = 0; i < equations.length; i++) {
            let node = equations[i]
            let formula = node.getAttribute('data-equation')
            katexRender(formula, node)
        }
        for (let i = 0; i < figureEquations.length; i++) {
            let node = figureEquations[i]
            let formula = node.getAttribute('data-equation')
            katexRender(formula, node, {
                displayMode: true
            })
        }

        if (aBook.chapters[i].part && aBook.chapters[i].part != '') {
            contentItems.push({
                link: 'document-' + aBook.chapters[i].number + '.xhtml',
                title: aChapter.part,
                docNum: aChapter.number,
                id: 0,
                level: -1,
                subItems: [],
            })
        }

        // Make links to all H1-3 and create a TOC list of them
        contentItems = contentItems.concat(setLinks(
            contents, aChapter.number))

     //   aChapter.contents = styleEpubFootnotes(contents)

        aChapter.contents = contents

        chapters.push(aChapter)

    }

    let includeZips = [],
        httpOutputList = []


    for (let i=0;i<chapters.length;i++) {

        chapters[i].contents = styleEpubFootnotes(chapters[i].contents)


        let xhtmlCode = xhtmlTemplate({
            part: chapters[i].part,
            shortLang: gettext('en'), // TODO: specify a document language rather than using the current users UI language
            title: chapters[i].document.title,
            metadata: chapters[i].document.metadata,
            settings: chapters[i].document.settings,
            styleSheets,
            body: obj2Node(node2Obj(chapters[i].contents), 'xhtml').innerHTML,
            math: chapters[i].math
        })

        xhtmlCode = replaceImgSrc(xhtmlCode)

        outputList.push({
            filename: 'EPUB/document-' + chapters[i].number + '.xhtml',
            contents: xhtmlCode
        })
    }

    contentItems.push({
        link: 'copyright.xhtml#copyright',
        title: gettext('Copyright'),
        docNum: 0,
        id: 2,
        level: 0,
        subItems: [],
    })

    contentItems = orderLinks(contentItems)

    let timestamp = getTimestamp()

    images = uniqueObjects(images)

    // mark cover image
    if (coverImage) {
        _.findWhere(images, {
            url: coverImage.image.split('?')[0]
        }).coverImage = true
    }

    let opfCode = epubBookOpfTemplate({
        language: gettext('en-US'), // TODO: specify a document language rather than using the current users UI language
        aBook,
        idType: 'fidus',
        date: timestamp.slice(0, 10), // TODO: the date should probably be the original document creation date instead
        modified: timestamp,
        styleSheets,
        math,
        images,
        chapters,
        coverImage,
        katexOpfIncludes,
        user
    })

    let ncxCode = ncxTemplate({
        shortLang: gettext('en'), // TODO: specify a document language rather than using the current users UI language
        title: aBook.title,
        idType: 'fidus',
        id: aBook.id,
        contentItems,
        templates
    })

    let navCode = navTemplate({
        shortLang: gettext('en'), // TODO: specify a document language rather than using the current users UI language
        contentItems,
        templates
    })

    outputList = outputList.concat([{
        filename: 'META-INF/container.xml',
        contents: containerTemplate({})
    }, {
        filename: 'EPUB/document.opf',
        contents: opfCode
    }, {
        filename: 'EPUB/document.ncx',
        contents: ncxCode
    }, {
        filename: 'EPUB/document-nav.xhtml',
        contents: navCode
    }, {
        filename: 'EPUB/titlepage.xhtml',
        contents: epubBookTitlepageTemplate({
            aBook: aBook
        })
    }, {
        filename: 'EPUB/copyright.xhtml',
        contents: epubBookCopyrightTemplate({
            aBook: aBook,
            creator: user.name,
            language: gettext('English') //TODO: specify a book language rather than using the current users UI language
        })
    }])




    for (let i = 0; i < styleSheets.length; i++) {
        outputList.push({
            filename: 'EPUB/' + styleSheets[i].filename,
            contents: styleSheets[i].contents
        })
    }



    for (let i = 0; i < images.length; i++) {
        httpOutputList.push({
            filename: 'EPUB/' + images[i].filename,
            url: images[i].url
        })
    }

    if (math) {
        includeZips.push({
            'directory': 'EPUB',
            'url': staticUrl + 'zip/katex-style.zip'
        })
    }

    zipFileCreator(outputList, httpOutputList, createSlug(
            aBook.title) +
        '.epub', 'application/epub+zip', includeZips)
}