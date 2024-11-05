/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/http'],

    (http) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            if(scriptContext.type === 'view') {
                let intPO = null;
                let arrPOIds = []
                let objRec = scriptContext.newRecord
                try {
                    let intItemCount = objRec.getLineCount('item')
                    for (let i = 0; i < intItemCount; i++) {
                        let intPOID = objRec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'podoc',
                            line: i
                        })
                        if (intPOID) {
                            arrPOIds.push(intPOID)
                        }
                    }
                    if (arrPOIds.length > 0) {
                        intPO = arrPOIds[0]
                    }

                    if (intPO) {
                        let objForm = scriptContext.form
                        objForm.clientScriptModulePath = 'SuiteScripts/ST-Lencia-RTCI-Print/Client Script/st_rcti_cs.js'
                        objForm.addButton({
                            id: 'custpage_rtci_btn',
                            label: 'Print RCTI',
                            functionName: `printRCTI(${objRec.id})`
                        })
                    }
                }catch (e) {
                    log.error('error creating printRCTI Button',e.message)
                }
            }

        }



        return {beforeLoad}

    });
