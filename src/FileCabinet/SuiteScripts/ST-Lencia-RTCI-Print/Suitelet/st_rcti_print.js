/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/file', 'N/record', 'N/render', 'N/config', 'N/search'],

    (file, record, render, config, search) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            const RCTI_XML_ID = 3300581
            let xmlFile = file.load({
                id: RCTI_XML_ID
            }).getContents()

            let intIFID = scriptContext.request.parameters.ifid
            log.debug('intIFID', intIFID)
            try {
                if (intIFID) {
                    let arrIFLines = []
                    let arrPOLines = []
                    let logoURL = `http://3529279.shop.netsuite.com/core/media/media.nl?id=3303907&amp;c=3529279&amp;h=kYXkCEr7Np2XuFG4ASgWo2Rk_is80jOTVseyegq7UghQ9u1-`
                    let objIFRec = record.load({
                        type: record.Type.ITEM_FULFILLMENT,
                        id: intIFID,
                    })
                    let strShipTo = ''
                    let strShipVia = ''
                    let strTrandate = objIFRec.getText('trandate')
                    let strReceiverRef =  objIFRec.getText('custbody_po_so')

                    let strShipCountry = ''
                    let intSO = objIFRec.getValue('createdfrom')
                    if(intSO) {
                        let objSO = record.load({
                            type:record.Type.SALES_ORDER,
                            id:intSO
                        })
                        strShipCountry = objSO.getValue('shipcountry')
                        //use this address if  SO ship country is US
                        if (strShipCountry === 'US') {
                            let strEntity = objSO.getText('entity')
                            let arrEntityName = strEntity.split(':')
                            strEntity = arrEntityName[1]
                            strShipTo+=strEntity+'<br/>'
                            strShipTo += 'Bell Total Logistics<br/>340 Hanson Road<br/>Wingfield SA 5013'
                            strShipVia = 'Your Carrier'
                        } else {
                            strShipTo = objIFRec.getValue('shipaddress')
                            strShipTo = strShipTo.replaceAll('\n', '<br/>')
                            strShipVia = 'DHL,call GetFreighted when collection required'
                        }
                    }

                    let objPOdetails = getPODetails(objIFRec)
                    log.debug('objPOdetails', objPOdetails)
                    let objVendBillDetails = getVendBillDetails(objPOdetails.id)
                    arrIFLines = getIFLines(objIFRec)
                    arrPOLines = objPOdetails.lineDetails
                    log.debug('arrIFLines', arrIFLines)
                    log.debug('arrPOLines', arrPOLines)

                    let arrMergedArray = mergeLineDetails(arrIFLines, arrPOLines)
                    log.debug('arrMergedArray', arrMergedArray)
                    let strItemTableXML = createItemTable(arrMergedArray)

                    let objCompanyInfo = getCompanyInfo()
                    let strCompanyAddress = (objCompanyInfo.address).replaceAll('\n', '<br/>')
                    strCompanyAddress = strCompanyAddress.replace('ABN', '<br/>ABN')

                    let strTranId = objIFRec.getValue('tranid')
                    let strInvoice = objIFRec.getText('custbody_invoice')
                    if (strInvoice) {
                        strInvoice = strInvoice.replace('Invoice', '')
                    }


                    xmlFile = xmlFile.replace('{BOOKINGNUMBER}', strReceiverRef)
                    xmlFile = xmlFile.replace('{LOGOURL}', logoURL)
                    xmlFile = xmlFile.replace('{SHIPTOADDRESS}', strShipTo)
                    xmlFile = xmlFile.replace('{SHIPVIA}', strShipVia)
                    xmlFile = xmlFile.replaceAll('{COMPANYNAME}', objCompanyInfo.name)
                    xmlFile = xmlFile.replaceAll('{COMPANYADDRESS}', strCompanyAddress)
                    xmlFile = xmlFile.replace('{ITEMROWS}', strItemTableXML)
                    xmlFile = xmlFile.replace('{PONUMBER}', objPOdetails.tranid)
                    xmlFile = xmlFile.replace('{POCOMMENTS}', objPOdetails.memo)
                    xmlFile = xmlFile.replace('{DELDOCKET}', strTranId)
                    xmlFile = xmlFile.replace('{BILLDATE}', strTrandate)
                    xmlFile = xmlFile.replace('{DUEDATE}', objVendBillDetails.duedate)
                    xmlFile = xmlFile.replace('{TERMS}', objPOdetails.terms)
                    xmlFile = xmlFile.replace('{AGNTBILLNUM}', strInvoice)
                    xmlFile = xmlFile.replace('{BILLINGADDRESS}', objPOdetails.vendorAddress)
                    xmlFile = xmlFile.replace('{SUBTOTAL}', formatCurrency(objPOdetails.subtotal))
                    xmlFile = xmlFile.replace('{TAXTOTAL}', formatCurrency(objPOdetails.taxtotal))
                    xmlFile = xmlFile.replace('{TOTALAMOUNT}', formatCurrency(objPOdetails.total))


                    let objPdf = render.xmlToPdf({
                        xmlString: xmlFile
                    })
                    scriptContext.response.writeFile({
                        file: objPdf,
                        isInline: true
                    });
                } else {
                    scriptContext.response.write({
                        output: 'Invalid URL'
                    });
                }
            }catch (e) {
                log.error('error generating PDF',e.message)
                scriptContext.response.write({
                    output: 'An Unexpected error occurred. Please Contact Administrator. Error Message:'+e.message
                });
            }

        }

        const getVendBillDetails = (intPOID) => {
            let objVendBillDetails = {}
            let intVendBill  = ''
            if (intPOID) {
                const transactionSearchFilters = [
                    ['internalidnumber', 'equalto', intPOID],
                ];
                const transactionSearchColTranId = search.createColumn({name: 'tranid'});
                const transactionSearchColBillingTransaction = search.createColumn({name: 'billingtransaction'});

                const transactionSearch = search.create({
                    type: 'transaction',
                    filters: transactionSearchFilters,
                    columns: [
                        transactionSearchColTranId,
                        transactionSearchColBillingTransaction,
                    ],
                });
                const transactionSearchPagedData = transactionSearch.runPaged({pageSize: 1000});
                for (let i = 0; i < transactionSearchPagedData.pageRanges.length; i++) {
                    const transactionSearchPage = transactionSearchPagedData.fetch({index: i});
                    transactionSearchPage.data.forEach((result) => {
                        const billingTransaction =result.getValue(transactionSearchColBillingTransaction);
                        log.debug('billingTransaction',billingTransaction)
                        if(billingTransaction){
                            intVendBill = billingTransaction
                        }
                    });
                }
                if(intVendBill){
                    let objVendBill = search.lookupFields({
                        type:search.Type.VENDOR_BILL,
                        id:intVendBill,
                        columns:['trandate','duedate']
                    })

                    log.debug('objVendBill',objVendBill)
                    objVendBillDetails.trandate = objVendBill.trandate
                    objVendBillDetails.duedate = objVendBill.duedate
                }
            }

            return objVendBillDetails


        }

        const getCompanyInfo = () => {
            let configRecObj = config.load({
                type: config.Type.COMPANY_INFORMATION
            });

            let strCompanyName = configRecObj.getValue('companyname')
            let strCompanyAddress = configRecObj.getValue('mainaddress_text')

            return {name: strCompanyName, address: strCompanyAddress}
        }

        function formatCurrency(value, locale = 'en-US', currency = 'USD') {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency
            }).format(value);
        }

        const createItemTable = (arrLines) => {
            let strXMLString = ''
            let arrItemsDetailOrder = ['itemname', 'quantity', 'unitsdisplay', 'description', 'rate', 'tax1amt', 'amount']
            for (let objDetails of arrLines) {
                strXMLString += '<tr>'
                for (let field of arrItemsDetailOrder) {
                    if (field === 'itemname' || field === 'quantity' || field === 'unitsdisplay' || field === 'description') {
                        strXMLString += `<td align="center">${objDetails[field]}</td>`
                    } else {
                        strXMLString += `<td align="center">${formatCurrency(objDetails[field].toFixed(2))}</td>`
                    }

                }
                strXMLString += '</tr>'
            }
            return strXMLString


        }

        const mergeLineDetails = (arrIFLines, arrPOLines) => {
            return arrIFLines.map(obj1 => {
                const match = arrPOLines.find(obj2 => obj2.item === obj1.item);
                return match ? {...obj1, ...match} : obj1;
            });
        }

        const getIFLines = (objIFRec) => {
            let arrLines = []
            let intItemCount = objIFRec.getLineCount('item')
            let arrItemDetailsToGet = ['itemname', 'item', 'description', 'unitsdisplay', 'quantity']
            for (let i = 0; i < intItemCount; i++) {
                let objLineDetail = {}
                for (let lineField of arrItemDetailsToGet) {
                    let value = objIFRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: lineField,
                        line: i
                    })
                    objLineDetail[lineField] = value
                }
                arrLines.push(objLineDetail)
            }
            log.debug('arrLines', arrLines)
            return arrLines
        }

        const getPODetails = (objIFRec) => {
            let objPODetail = {}
            let arrPOIds = []
            let arrPOBodyFields = ['total', 'taxtotal', 'subtotal', 'tranid', 'memo']
            let arrItemDetailsToGet = ['item', 'rate', 'amount', 'tax1amt']
            let intItemCount = objIFRec.getLineCount('item')
            for (let i = 0; i < intItemCount; i++) {
                let intPOID = objIFRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'podoc',
                    line: i
                })
                if (intPOID) {
                    arrPOIds.push(intPOID)
                }
            }
            if (arrPOIds.length > 0) {
                arrPOIds = cleanArray(arrPOIds)
                let intPOID = arrPOIds[0]
                let objPO = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: intPOID,
                })

                let arrLines = []
                for (let i = 0; i < intItemCount; i++) {
                    let objLineDetail = {}
                    for (let lineField of arrItemDetailsToGet) {
                        let value = objPO.getSublistValue({
                            sublistId: 'item',
                            fieldId: lineField,
                            line: i
                        })
                        objLineDetail[lineField] = value
                    }
                    arrLines.push(objLineDetail)
                }
                log.debug('arrLines', arrLines)
                let strTerm = objPO.getText('terms')
                let dteTrandate = objPO.getText('trandate')
                objPODetail = {
                    id: intPOID,
                    date: dteTrandate,
                    terms: strTerm,
                    lineDetails: arrLines
                }

                for (let field of arrPOBodyFields) {
                    let value = objPO.getValue(field)
                    objPODetail[field] = value;
                }


                //get PO Vendor Address
                let intVendor = objPO.getValue('entity')
                let objVendor = record.load({
                    type: record.Type.VENDOR,
                    id: intVendor,
                })
                let strVendAddress = objVendor.getText('defaultaddress')
                log.debug('strVendAddress', strVendAddress)
                strVendAddress = strVendAddress.replaceAll('\n', '<br/>')
                objPODetail.vendorAddress = strVendAddress
                log.debug('objPODetail', objPODetail)

            }

            return objPODetail
        }

        function cleanArray(arr) {
            return [...new Set(arr.filter(value => value))];
        }

        return {onRequest}

    });
