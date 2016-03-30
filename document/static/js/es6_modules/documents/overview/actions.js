import {getMissingDocumentListData} from "../tools"
import {importFidusTemplate, documentsListItemTemplate} from "./templates"
import {savecopy} from "../../exporter/copy"
import {downloadEpub} from "../../exporter/epub"
import {downloadHtml} from "../../exporter/html"
import {downloadLatex} from "../../exporter/latex"
import {downloadNative} from "../../exporter/native"
import {ImportFidusFile} from "../../importer/file"
import {DocumentRevisionsDialog} from "../revisions/dialog"

export class DocumentOverviewActions {
    constructor (documentOverview) {
        documentOverview.mod.actions = this
        this.documentOverview = documentOverview
    }

    deleteDocument(id) {
        let that = this
        let postData = {id}

        $.ajax({
            url: '/document/delete/',
            data: postData,
            type: 'POST',
            dataType: 'json',
            success: function (data, textStatus, jqXHR) {
                that.documentOverview.stopDocumentTable()
                jQuery('#Text_' + id).detach()
                that.documentOverview.documentList = _.reject(that.documentOverview.documentList, function (
                    document) {
                    return document.id == id
                })
                that.documentOverview.startDocumentTable()
            }
        })
    }

    deleteDocumentDialog(ids) {
        let that = this
        jQuery('body').append('<div id="confirmdeletion" title="' + gettext(
                'Confirm deletion') +
            '"><p><span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
            gettext('Delete the document(s)?') + '</p></div>')
        let diaButtons = {}
        diaButtons[gettext('Delete')] = function () {
            for (let i = 0; i < ids.length; i++) {
                that.deleteDocument(ids[i])
            }
            jQuery(this).dialog("close")
            $.addAlert('success', gettext(
                'The document(s) have been deleted'))
        }

        diaButtons[gettext('Cancel')] = function () {
            jQuery(this).dialog("close")
        }

        jQuery("#confirmdeletion").dialog({
            resizable: false,
            height: 180,
            modal: true,
            close: function () {
                jQuery("#confirmdeletion").detach()
            },
            buttons: diaButtons,
            create: function () {
                let theDialog = jQuery(this).closest(".ui-dialog")
                theDialog.find(".ui-button:first-child").addClass(
                    "fw-button fw-dark")
                theDialog.find(".ui-button:last").addClass(
                    "fw-button fw-orange")
            }
        })
    }

    importFidus() {
        let that = this
        jQuery('body').append(importFidusTemplate())
        diaButtons = {}
        diaButtons[gettext('Import')] = function () {
            let fidusFile = jQuery('#fidus-uploader')[0].files
            if (0 == fidusFile.length) {
                console.log('no file found')
                return false
            }
            fidusFile = fidusFile[0]
            if (104857600 < fidusFile.size) {
                //TODO: This is an arbitrary size. What should be done with huge import files?
                console.log('file too big')
                return false
            }
            $.activateWait()
            let reader = new FileReader()
            reader.onerror = function (e) {
                console.log('error', e.target.error.code)
            }

            new ImportFidusFile(
                fidusFile,
                that.documentOverview.user,
                true,
                function(noErrors, returnValue) {
                    $.deactivateWait()
                    if (noErrors) {
                        let aDocument = returnValue.aDocument
                        let aDocumentValues = returnValue.aDocumentValues
                        jQuery.addAlert('info', aDocument.title + gettext(
                                ' successfully imported.'))
                        that.documentOverview.documentList.push(aDocument)
                        that.documentOverview.stopDocumentTable()
                        jQuery('#document-table tbody').append(
                            documentsListItemTemplate({
                                    aDocument,
                                    user: that.documentOverview.user
                                }))
                        that.documentOverview.startDocumentTable()
                    } else {
                        jQuery.addAlert('error', returnValue)
                    }
                }
            )
            //reader.onload = unzip
            //reader.readAsText(fidusFile)
            jQuery(this).dialog('close')
        }
        diaButtons[gettext('Cancel')] = function () {
            jQuery(this).dialog('close')
        }
        jQuery("#importfidus").dialog({
            resizable: false,
            height: 180,
            modal: true,
            buttons: diaButtons,
            create: function () {
                let theDialog = jQuery(this).closest(".ui-dialog")
                theDialog.find(".ui-button:first-child").addClass(
                    "fw-button fw-dark")
                theDialog.find(".ui-button:last").addClass(
                    "fw-button fw-orange")
                jQuery('#fidus-uploader').bind('change', function () {
                    jQuery('#import-fidus-name').html(jQuery(this).val()
                        .replace(
                            /C:\\fakepath\\/i, ''))
                })
                jQuery('#import-fidus-btn').bind('mousedown', function () {
                    console.log('triggering')
                    jQuery('#fidus-uploader').trigger('click')
                })
            },
            close: function () {
                jQuery("#importfidus").dialog('destroy').remove()
            }
        })


    }

    copyFiles(ids) {
        let that = this
        getMissingDocumentListData(ids, that.documentOverview.documentList, function () {
            for (let i = 0; i < ids.length; i++) {
                savecopy(_.findWhere(that.documentOverview.documentList, {
                    id: ids[i]
                }), false, that.documentOverview.user, function (returnValue) {
                    let aDocument = returnValue.aDocument
                    that.documentOverview.documentList.push(aDocument)
                    that.documentOverview.stopDocumentTable()
                    jQuery('#document-table tbody').append(
                        documentsListItemTemplate({aDocument, user: that.documentOverview.user}))
                    that.documentOverview.startDocumentTable()
                })
            }
        })
    }

    downloadNativeFiles(ids) {
        let that = this
        getMissingDocumentListData(ids, that.documentOverview.documentList, function () {
            for (let i = 0; i < ids.length; i++) {
                downloadNative(_.findWhere(
                    that.documentOverview.documentList, {
                        id: ids[i]
                    }), false)
            }
        })
    }

    downloadHtmlFiles(ids) {
        let that = this
        getMissingDocumentListData(ids, that.documentOverview.documentList, function () {
            for (let i = 0; i < ids.length; i++) {
                downloadHtml(_.findWhere(
                    that.documentOverview.documentList, {
                        id: ids[i]
                    }), false)
            }
        })
    }

    downloadLatexFiles(ids) {
        let that = this
        getMissingDocumentListData(ids, that.documentOverview.documentList, function () {
            for (let i = 0; i < ids.length; i++) {
                downloadLatex(_.findWhere(
                    that.documentOverview.documentList, {
                        id: ids[i]
                    }), false)
            }
        })
    }

    downloadEpubFiles(ids) {
        let that = this
        getMissingDocumentListData(ids, that.documentOverview.documentList, function () {
            for (let i = 0; i < ids.length; i++) {
                downloadEpub(_.findWhere(
                    that.documentOverview.documentList, {
                        id: ids[i]
                    }), false)
            }
        })
    }

    revisionsDialog(documentId) {
        let that = this
        new DocumentRevisionsDialog(documentId, that.documentOverview.documentList, that.documentOverview.user, function (actionObject) {
            switch(actionObject.action) {
                case 'added-document':
                    that.documentOverview.documentList.push(actionObject.doc)
                    that.documentOverview.stopDocumentTable()
                    jQuery('#document-table tbody').append(
                        documentsListItemTemplate({
                            aDocument: actionObject.doc,
                            user: that.documentOverview.user
                        }))
                    that.documentOverview.startDocumentTable()
                    break
                case 'deleted-revision':
                    actionObject.doc.revisions = _.reject(actionObject.doc.revisions, function(revision) {
                        return (revision.pk == actionObject.id)
                    })
                    if (actionObject.doc.revisions.length === 0) {
                        jQuery('#Text_' + actionObject.doc.id + ' .revisions').detach()
                    }
                    break
            }

        })
    }





}