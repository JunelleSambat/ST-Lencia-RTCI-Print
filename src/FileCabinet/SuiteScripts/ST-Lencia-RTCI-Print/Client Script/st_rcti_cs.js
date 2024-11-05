/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/url'],

function(url) {
    
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {

    }
    function printRCTI(intIFID) {

        console.log('intIFID:'+intIFID)
        let strURL = url.resolveScript({
            scriptId: 'customscript_sl_rtci_print',
            deploymentId: 'customdeploy_sl_rtci_print',
            returnExternalUrl: false
        });
        console.log('strURL:'+strURL)
        window.open(strURL+'&ifid='+intIFID, '_blank');
    }



    return {
        pageInit: pageInit,
        printRCTI:printRCTI
    };
    
});
