(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/api/farms.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "generateFarmsData",
    ()=>generateFarmsData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$env$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/env.ts [app-client] (ecmascript)");
;
const generateFarmsData = async (data, locale)=>{
    const url = `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$env$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FARMS_PARSER_URL"]}${locale ? `?locale=${locale}` : ""}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        throw new Error("Error on parse farms");
    }
    return response.json();
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/api/polygonValidation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "validatePolygons",
    ()=>validatePolygons
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$env$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/env.ts [app-client] (ecmascript)");
;
const validatePolygons = async (data)=>{
    const body = data.map(({ id, polygon })=>({
            id,
            type: polygon.type,
            details: polygon.details
        }));
    const response = await fetch(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$env$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["POLYGON_VALIDATION_URL"], {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error("Error validating polygons");
    }
    return response.json();
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/page/polygonsValidation/PolygonsValidationUploadDataPageContent.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PolygonsValidationUploadDataPageContent",
    ()=>PolygonsValidationUploadDataPageContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$page$2f$uploadData$2f$UploadPageContent$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/page/uploadData/UploadPageContent.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$api$2f$farms$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/api/farms.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$api$2f$polygonValidation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/api/polygonValidation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$DataContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/DataContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$SnackbarContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/SnackbarContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$LoadingScreen$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/LoadingScreen.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$page$2f$uploadData$2f$DownloadTemplateStep$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/page/uploadData/DownloadTemplateStep.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$page$2f$uploadData$2f$UploadFileStep$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/page/uploadData/UploadFileStep.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-i18next@17.0.15_i18next@26.4.2_typescript@6.0.3__react-dom@19.3.0_react@19.3.0__react@19.3.0_typescript@6.0.3/node_modules/react-i18next/dist/es/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$useTranslation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-i18next@17.0.15_i18next@26.4.2_typescript@6.0.3__react-dom@19.3.0_react@19.3.0__react@19.3.0_typescript@6.0.3/node_modules/react-i18next/dist/es/useTranslation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$page$2f$uploadData$2f$TextHeaderStepContainer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/page/uploadData/TextHeaderStepContainer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lodash$40$4$2e$18$2e$1$2f$node_modules$2f$lodash$2f$sum$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/lodash@4.18.1/node_modules/lodash/sum.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$excel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/utils/excel.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function PolygonsValidationUploadDataPageContent() {
    _s();
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const { openSnackbar } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$SnackbarContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SnackbarContext"]);
    const { farmsData, setFarmsData, setPolygonsValidationResults } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$DataContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DataContext"]);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { t, i18n } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$useTranslation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslation"])();
    const prevDataRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const performFarmsGeneration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "PolygonsValidationUploadDataPageContent.useCallback[performFarmsGeneration]": async (data)=>{
            try {
                const results = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$api$2f$farms$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateFarmsData"])(data, i18n.language);
                setFarmsData(results);
            } catch (error) {
                console.error(error);
                openSnackbar({
                    message: t("common:snackbarAlerts:parsingFarmsDataError"),
                    type: "error"
                });
                setLoading(false);
                return;
            }
        }
    }["PolygonsValidationUploadDataPageContent.useCallback[performFarmsGeneration]"], [
        openSnackbar,
        setFarmsData,
        t,
        i18n.language
    ]);
    const performValidationAnalysis = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "PolygonsValidationUploadDataPageContent.useCallback[performValidationAnalysis]": async (data)=>{
            setLoading(true);
            try {
                const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$api$2f$polygonValidation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validatePolygons"])(data);
                setPolygonsValidationResults(response);
                router.push("/polygons-validation");
                openSnackbar({
                    message: t("common:snackbarAlerts:dataAnalizedSuccessfully"),
                    type: "success"
                });
                const inconsistenciesCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lodash$40$4$2e$18$2e$1$2f$node_modules$2f$lodash$2f$sum$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(response.inconsistencies.map({
                    "PolygonsValidationUploadDataPageContent.useCallback[performValidationAnalysis].inconsistenciesCount": ({ farmIds })=>farmIds.length
                }["PolygonsValidationUploadDataPageContent.useCallback[performValidationAnalysis].inconsistenciesCount"]));
                if (inconsistenciesCount > 0) {
                    openSnackbar({
                        message: t(`polygonValidation:inconsistentPolygonsFound.${inconsistenciesCount === 1 ? "singular" : "plural"}`, {
                            count: inconsistenciesCount
                        }),
                        type: "warning"
                    });
                }
            } catch (error) {
                console.error(error);
                openSnackbar({
                    message: t("common:snackbarAlerts:performingAnalysisError"),
                    type: "error"
                });
                setLoading(false);
            }
        }
    }["PolygonsValidationUploadDataPageContent.useCallback[performValidationAnalysis]"], [
        setPolygonsValidationResults,
        router,
        openSnackbar,
        t
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PolygonsValidationUploadDataPageContent.useEffect": ()=>{
            const serializedData = JSON.stringify(farmsData?.map({
                "PolygonsValidationUploadDataPageContent.useEffect.serializedData": (d)=>d.id
            }["PolygonsValidationUploadDataPageContent.useEffect.serializedData"]));
            if (serializedData === prevDataRef.current) return;
            prevDataRef.current = serializedData;
            if (!farmsData) return;
            performValidationAnalysis(farmsData);
        }
    }["PolygonsValidationUploadDataPageContent.useEffect"], [
        farmsData,
        performValidationAnalysis
    ]);
    const onFileDropped = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "PolygonsValidationUploadDataPageContent.useCallback[onFileDropped]": async (acceptedFiles)=>{
            setLoading(true);
            const file = acceptedFiles[0];
            const { data, errorMessages } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$excel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadExcelFileFarmsData"])(file, t, i18n.language);
            if (errorMessages.length > 0) {
                for (const errorMessage of errorMessages){
                    openSnackbar({
                        message: errorMessage,
                        type: "error"
                    });
                }
                setLoading(false);
                return;
            } else {
                performFarmsGeneration(data);
            }
        }
    }["PolygonsValidationUploadDataPageContent.useCallback[onFileDropped]"], [
        performFarmsGeneration,
        openSnackbar,
        t,
        i18n.language
    ]);
    if (loading) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$LoadingScreen$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LoadingScreen"], {
        text: t("polygonValidation:uploadDataPage:loadingText")
    }, void 0, false, {
        fileName: "[project]/src/components/page/polygonsValidation/PolygonsValidationUploadDataPageContent.tsx",
        lineNumber: 132,
        columnNumber: 7
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$page$2f$uploadData$2f$UploadPageContent$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UploadPageContent"], {
        title: t("polygonValidation:uploadDataPage:title"),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$page$2f$uploadData$2f$TextHeaderStepContainer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextHeaderStepContainer"], {
                title: t("polygonValidation:uploadDataPage:templateStep:stepTitle"),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$page$2f$uploadData$2f$DownloadTemplateStep$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DownloadTemplateStep"], {
                    title: t("polygonValidation:uploadDataPage:templateStep:title"),
                    description: t("polygonValidation:uploadDataPage:templateStep:description"),
                    buttonText: t("polygonValidation:uploadDataPage:templateStep:buttonText"),
                    fileUrl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$excel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUploadFileTemplatePath"])(i18n.language)
                }, void 0, false, {
                    fileName: "[project]/src/components/page/polygonsValidation/PolygonsValidationUploadDataPageContent.tsx",
                    lineNumber: 140,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/page/polygonsValidation/PolygonsValidationUploadDataPageContent.tsx",
                lineNumber: 137,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$page$2f$uploadData$2f$TextHeaderStepContainer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextHeaderStepContainer"], {
                title: t("polygonValidation:uploadDataPage:uploadStep:stepTitle"),
                sx: {
                    flexGrow: 1
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$page$2f$uploadData$2f$UploadFileStep$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UploadFileStep"], {
                    texts: {
                        inactiveDragzoneCallToAction: t("polygonValidation:uploadDataPage:uploadStep:inactiveDragzoneCallToAction"),
                        activeDragzoneCallToAction: t("polygonValidation:uploadDataPage:uploadStep:activeDragzoneCallToAction"),
                        buttonText: t("polygonValidation:uploadDataPage:uploadStep:dragzoneButtonText"),
                        text: t("polygonValidation:uploadDataPage:uploadStep:dragzoneText")
                    },
                    fileAccept: {
                        "application/vnd.ms-excel": [
                            ".xls"
                        ],
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
                            ".xlsx"
                        ]
                    },
                    onDrop: onFileDropped
                }, void 0, false, {
                    fileName: "[project]/src/components/page/polygonsValidation/PolygonsValidationUploadDataPageContent.tsx",
                    lineNumber: 155,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/page/polygonsValidation/PolygonsValidationUploadDataPageContent.tsx",
                lineNumber: 151,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/page/polygonsValidation/PolygonsValidationUploadDataPageContent.tsx",
        lineNumber: 136,
        columnNumber: 5
    }, this);
}
_s(PolygonsValidationUploadDataPageContent, "YIYi6QI5qR1bTRJpZ0LbE6jKvVE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$useTranslation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslation"]
    ];
});
_c = PolygonsValidationUploadDataPageContent;
var _c;
__turbopack_context__.k.register(_c, "PolygonsValidationUploadDataPageContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/page/uploadData/DownloadTemplateStep.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DownloadTemplateStep",
    ()=>DownloadTemplateStep
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Box/Box.js [app-client] (ecmascript) <export default as Box>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Button$2f$Button$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Button$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Button/Button.js [app-client] (ecmascript) <export default as Button>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/Text.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$SectionBackground$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/SectionBackground.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$icons$2d$material$40$7$2e$3$2e$11_$40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$_4754e80940a3ffa8370eae75def316a0$2f$node_modules$2f40$mui$2f$icons$2d$material$2f$esm$2f$Download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+icons-material@7.3.11_@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19._4754e80940a3ffa8370eae75def316a0/node_modules/@mui/icons-material/esm/Download.js [app-client] (ecmascript)");
"use client";
;
;
;
;
;
const DownloadTemplateStep = ({ title, description, buttonText, fileUrl })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$SectionBackground$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SectionBackground"], {
        sx: {
            backgroundColor: "#F5F5F5",
            padding: 2,
            borderRadius: 2,
            display: "flex",
            justifyContent: "space-between"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                        variant: "body1",
                        bold: true,
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/src/components/page/uploadData/DownloadTemplateStep.tsx",
                        lineNumber: 32,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                        variant: "body1",
                        color: "secondary",
                        children: description
                    }, void 0, false, {
                        fileName: "[project]/src/components/page/uploadData/DownloadTemplateStep.tsx",
                        lineNumber: 35,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/page/uploadData/DownloadTemplateStep.tsx",
                lineNumber: 31,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
                sx: {
                    display: "flex",
                    alignItems: "center",
                    marginLeft: 12
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    target: "_blank",
                    href: fileUrl,
                    rel: "noopener noreferrer",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Button$2f$Button$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Button$3e$__["Button"], {
                        variant: "contained",
                        endIcon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$icons$2d$material$40$7$2e$3$2e$11_$40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$_4754e80940a3ffa8370eae75def316a0$2f$node_modules$2f40$mui$2f$icons$2d$material$2f$esm$2f$Download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                            fileName: "[project]/src/components/page/uploadData/DownloadTemplateStep.tsx",
                            lineNumber: 41,
                            columnNumber: 48
                        }, ("TURBOPACK compile-time value", void 0)),
                        children: buttonText
                    }, void 0, false, {
                        fileName: "[project]/src/components/page/uploadData/DownloadTemplateStep.tsx",
                        lineNumber: 41,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/src/components/page/uploadData/DownloadTemplateStep.tsx",
                    lineNumber: 40,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/src/components/page/uploadData/DownloadTemplateStep.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/page/uploadData/DownloadTemplateStep.tsx",
        lineNumber: 22,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = DownloadTemplateStep;
var _c;
__turbopack_context__.k.register(_c, "DownloadTemplateStep");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/page/uploadData/TextHeaderStepContainer.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TextHeaderStepContainer",
    ()=>TextHeaderStepContainer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Divider$2f$Divider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Divider$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Divider/Divider.js [app-client] (ecmascript) <export default as Divider>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/Text.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$SectionBackground$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/SectionBackground.tsx [app-client] (ecmascript)");
;
;
;
;
const TextHeaderStepContainer = ({ sx, title, children })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$SectionBackground$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SectionBackground"], {
        sx: {
            padding: 2,
            flexDirection: "column",
            ...sx
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                variant: "h4",
                bold: true,
                children: title
            }, void 0, false, {
                fileName: "[project]/src/components/page/uploadData/TextHeaderStepContainer.tsx",
                lineNumber: 17,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Divider$2f$Divider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Divider$3e$__["Divider"], {
                sx: {
                    marginTop: 2,
                    marginBottom: 2
                }
            }, void 0, false, {
                fileName: "[project]/src/components/page/uploadData/TextHeaderStepContainer.tsx",
                lineNumber: 20,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/page/uploadData/TextHeaderStepContainer.tsx",
        lineNumber: 16,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = TextHeaderStepContainer;
var _c;
__turbopack_context__.k.register(_c, "TextHeaderStepContainer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/page/uploadData/UploadFileStep.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "UploadFileStep",
    ()=>UploadFileStep
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Box/Box.js [app-client] (ecmascript) <export default as Box>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$DropZone$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/DropZone.tsx [app-client] (ecmascript)");
;
;
;
const UploadFileStep = ({ texts, fileAccept, onDrop, disabled })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
        sx: {
            display: "flex",
            flexGrow: 1
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$DropZone$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DropZone"], {
            onDrop: onDrop,
            accept: fileAccept,
            texts: texts,
            disabled: disabled
        }, void 0, false, {
            fileName: "[project]/src/components/page/uploadData/UploadFileStep.tsx",
            lineNumber: 25,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/page/uploadData/UploadFileStep.tsx",
        lineNumber: 24,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = UploadFileStep;
var _c;
__turbopack_context__.k.register(_c, "UploadFileStep");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/page/uploadData/UploadPageContent.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "UploadPageContent",
    ()=>UploadPageContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Box/Box.js [app-client] (ecmascript) <export default as Box>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/Text.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$DevEnvWarning$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/DevEnvWarning.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$env$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/env.ts [app-client] (ecmascript)");
"use client";
;
;
;
;
;
const UploadPageContent = ({ title, children })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
        sx: {
            padding: 1.5,
            paddingTop: 3,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minHeight: "calc(100vh - 64px)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
                sx: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                        variant: "h3",
                        sx: {
                            marginLeft: 1.5
                        },
                        bold: true,
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/src/components/page/uploadData/UploadPageContent.tsx",
                        lineNumber: 33,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$env$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SHOW_TESTING_ENVIRONMENT_WARNING"] && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$DevEnvWarning$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DevEnvWarning"], {}, void 0, false, {
                        fileName: "[project]/src/components/page/uploadData/UploadPageContent.tsx",
                        lineNumber: 36,
                        columnNumber: 46
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/page/uploadData/UploadPageContent.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/page/uploadData/UploadPageContent.tsx",
        lineNumber: 16,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = UploadPageContent;
var _c;
__turbopack_context__.k.register(_c, "UploadPageContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/reusable/DevEnvWarning.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DevEnvWarning",
    ()=>DevEnvWarning
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Box/Box.js [app-client] (ecmascript) <export default as Box>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Typography$2f$Typography$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Typography$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Typography/Typography.js [app-client] (ecmascript) <export default as Typography>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$icons$2d$material$40$7$2e$3$2e$11_$40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$_4754e80940a3ffa8370eae75def316a0$2f$node_modules$2f40$mui$2f$icons$2d$material$2f$esm$2f$Warning$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+icons-material@7.3.11_@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19._4754e80940a3ffa8370eae75def316a0/node_modules/@mui/icons-material/esm/Warning.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-i18next@17.0.15_i18next@26.4.2_typescript@6.0.3__react-dom@19.3.0_react@19.3.0__react@19.3.0_typescript@6.0.3/node_modules/react-i18next/dist/es/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$useTranslation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-i18next@17.0.15_i18next@26.4.2_typescript@6.0.3__react-dom@19.3.0_react@19.3.0__react@19.3.0_typescript@6.0.3/node_modules/react-i18next/dist/es/useTranslation.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
const DevEnvWarning = ()=>{
    _s();
    const { t } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$useTranslation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslation"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
        sx: {
            width: "max-content"
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
            sx: {
                display: "flex",
                alignItems: "center",
                height: "max-content",
                color: "#ED6C02",
                backgroundColor: "#FFF5E5",
                padding: "4px 16px",
                fontSize: "12px",
                borderRadius: 1
            },
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$icons$2d$material$40$7$2e$3$2e$11_$40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$_4754e80940a3ffa8370eae75def316a0$2f$node_modules$2f40$mui$2f$icons$2d$material$2f$esm$2f$Warning$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    fontSize: "medium",
                    sx: {
                        marginRight: 0.5
                    }
                }, void 0, false, {
                    fileName: "[project]/src/components/reusable/DevEnvWarning.tsx",
                    lineNumber: 23,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Typography$2f$Typography$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Typography$3e$__["Typography"], {
                    variant: "body2",
                    sx: {
                        marginLeft: "5px",
                        color: "#663C00",
                        fontWeight: 500
                    },
                    children: t("home:devWarning")
                }, void 0, false, {
                    fileName: "[project]/src/components/reusable/DevEnvWarning.tsx",
                    lineNumber: 24,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/reusable/DevEnvWarning.tsx",
            lineNumber: 11,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/reusable/DevEnvWarning.tsx",
        lineNumber: 10,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(DevEnvWarning, "zlIdU9EjM2llFt74AbE2KsUJXyM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$useTranslation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslation"]
    ];
});
_c = DevEnvWarning;
var _c;
__turbopack_context__.k.register(_c, "DevEnvWarning");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/reusable/DropZone.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DropZone",
    ()=>DropZone
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Box/Box.js [app-client] (ecmascript) <export default as Box>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/Text.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$dropzone$40$20$2e$1$2e$2_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0$2f$node_modules$2f$react$2d$dropzone$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-dropzone@20.1.2_@types+react@19.3.0_react@19.3.0/node_modules/react-dropzone/dist/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$SnackbarContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/SnackbarContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-i18next@17.0.15_i18next@26.4.2_typescript@6.0.3__react-dom@19.3.0_react@19.3.0__react@19.3.0_typescript@6.0.3/node_modules/react-i18next/dist/es/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$useTranslation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/react-i18next@17.0.15_i18next@26.4.2_typescript@6.0.3__react-dom@19.3.0_react@19.3.0__react@19.3.0_typescript@6.0.3/node_modules/react-i18next/dist/es/useTranslation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lodash$40$4$2e$18$2e$1$2f$node_modules$2f$lodash$2f$uniqBy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/lodash@4.18.1/node_modules/lodash/uniqBy.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
const DropZone = ({ onDrop, accept, texts, disabled })=>{
    _s();
    const { openSnackbar } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$SnackbarContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SnackbarContext"]);
    const { t } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$useTranslation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslation"])();
    const handleOnDrop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "DropZone.useCallback[handleOnDrop]": (acceptedFiles, fileRejections)=>{
            if (fileRejections.length > 0) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lodash$40$4$2e$18$2e$1$2f$node_modules$2f$lodash$2f$uniqBy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(fileRejections.flatMap({
                    "DropZone.useCallback[handleOnDrop]": (fr)=>fr.errors
                }["DropZone.useCallback[handleOnDrop]"]), "code").forEach({
                    "DropZone.useCallback[handleOnDrop]": (e)=>{
                        openSnackbar({
                            message: t(`common:fileErrors:${e.code}`),
                            type: "error"
                        });
                    }
                }["DropZone.useCallback[handleOnDrop]"]);
                return;
            }
            onDrop(acceptedFiles);
        }
    }["DropZone.useCallback[handleOnDrop]"], [
        onDrop,
        openSnackbar,
        t
    ]);
    const { getRootProps, getInputProps, isDragActive } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$dropzone$40$20$2e$1$2e$2_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0$2f$node_modules$2f$react$2d$dropzone$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDropzone"])({
        onDrop: handleOnDrop,
        accept,
        multiple: false,
        disabled
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
        ...getRootProps(),
        sx: {
            flexGrow: 1,
            border: "1px dashed #03689E",
            backgroundColor: "#3463761A",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
            sx: {
                display: "flex",
                flexDirection: "column",
                gap: 1
            },
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    ...getInputProps()
                }, void 0, false, {
                    fileName: "[project]/src/components/reusable/DropZone.tsx",
                    lineNumber: 78,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                isDragActive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                    variant: "h3",
                    textAlign: "center",
                    bold: true,
                    boldWeight: 600,
                    children: texts.activeDragzoneCallToAction
                }, void 0, false, {
                    fileName: "[project]/src/components/reusable/DropZone.tsx",
                    lineNumber: 80,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                            variant: "h3",
                            textAlign: "center",
                            bold: true,
                            boldWeight: 600,
                            children: texts.inactiveDragzoneCallToAction
                        }, void 0, false, {
                            fileName: "[project]/src/components/reusable/DropZone.tsx",
                            lineNumber: 85,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                            variant: "body1",
                            textAlign: "center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                                    variant: "body1",
                                    component: "span",
                                    sx: {
                                        color: "primary.main",
                                        textDecoration: "underline",
                                        cursor: "pointer"
                                    },
                                    children: texts.buttonText
                                }, void 0, false, {
                                    fileName: "[project]/src/components/reusable/DropZone.tsx",
                                    lineNumber: 89,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                " ",
                                texts.text
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/reusable/DropZone.tsx",
                            lineNumber: 88,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                            color: "secondary",
                            variant: "body2",
                            textAlign: "center",
                            children: [
                                ".xlsx ",
                                t("_or"),
                                " .xls"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/reusable/DropZone.tsx",
                            lineNumber: 102,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/reusable/DropZone.tsx",
                    lineNumber: 84,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/reusable/DropZone.tsx",
            lineNumber: 71,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/reusable/DropZone.tsx",
        lineNumber: 60,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(DropZone, "F2SAYEs1tf/+OgsE7AVVyPcrqZ8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$i18next$40$17$2e$0$2e$15_i18next$40$26$2e$4$2e$2_typescript$40$6$2e$0$2e$3_$5f$react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0_typescript$40$6$2e$0$2e$3$2f$node_modules$2f$react$2d$i18next$2f$dist$2f$es$2f$useTranslation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslation"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$react$2d$dropzone$40$20$2e$1$2e$2_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0$2f$node_modules$2f$react$2d$dropzone$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDropzone"]
    ];
});
_c = DropZone;
var _c;
__turbopack_context__.k.register(_c, "DropZone");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/reusable/LoadingScreen.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoadingScreen",
    ()=>LoadingScreen
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Box/Box.js [app-client] (ecmascript) <export default as Box>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Paper$2f$Paper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Paper$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Paper/Paper.js [app-client] (ecmascript) <export default as Paper>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$CircularProgress$2f$CircularProgress$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CircularProgress$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/CircularProgress/CircularProgress.js [app-client] (ecmascript) <export default as CircularProgress>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reusable/Text.tsx [app-client] (ecmascript)");
;
;
;
const LoadingScreen = ({ text })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
        sx: {
            height: "calc(100vh - 64px)",
            padding: 3
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Paper$2f$Paper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Paper$3e$__["Paper"], {
            sx: {
                width: "100%",
                height: "100%",
                backgroundColor: "#F5F5F5",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 2
            },
            elevation: 0,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Box$2f$Box$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Box$3e$__["Box"], {
                sx: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$CircularProgress$2f$CircularProgress$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CircularProgress$3e$__["CircularProgress"], {
                        size: 120
                    }, void 0, false, {
                        fileName: "[project]/src/components/reusable/LoadingScreen.tsx",
                        lineNumber: 36,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reusable$2f$Text$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Text"], {
                        variant: "body1",
                        children: text
                    }, void 0, false, {
                        fileName: "[project]/src/components/reusable/LoadingScreen.tsx",
                        lineNumber: 37,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reusable/LoadingScreen.tsx",
                lineNumber: 28,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/src/components/reusable/LoadingScreen.tsx",
            lineNumber: 16,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/reusable/LoadingScreen.tsx",
        lineNumber: 10,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = LoadingScreen;
var _c;
__turbopack_context__.k.register(_c, "LoadingScreen");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/reusable/SectionBackground.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SectionBackground",
    ()=>SectionBackground
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.6_@babel+core@7.29.7_@types+node@24.13.6_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$styles$2f$styled$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__$3c$export__default__as__styled$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/styles/styled.js [app-client] (ecmascript) <locals> <export default as styled>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Paper$2f$Paper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@mui+material@7.3.11_@emotion+react@11.14.0_@types+react@19.3.0_react@19.3.0__@emotion+_13eda6303143b5c530a807586fc3e0f8/node_modules/@mui/material/esm/Paper/Paper.js [app-client] (ecmascript)");
"use client";
;
;
;
const StylizedPaper = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$styles$2f$styled$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__$3c$export__default__as__styled$3e$__["styled"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$mui$2b$material$40$7$2e$3$2e$11_$40$emotion$2b$react$40$11$2e$14$2e$0_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f40$emotion$2b$_13eda6303143b5c530a807586fc3e0f8$2f$node_modules$2f40$mui$2f$material$2f$esm$2f$Paper$2f$Paper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(({ theme })=>({
        backgroundColor: "#FFF",
        padding: theme.spacing(1),
        borderColor: "#DEDEDE",
        borderWidth: 1,
        display: "flex",
        height: "100%"
    }));
_c = StylizedPaper;
const SectionBackground = ({ children, ...props })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$6_$40$babel$2b$core$40$7$2e$29$2e$7_$40$types$2b$node$40$24$2e$13$2e$6_react$2d$dom$40$19$2e$3$2e$0_react$40$19$2e$3$2e$0_$5f$react$40$19$2e$3$2e$0$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StylizedPaper, {
        elevation: 0,
        ...props,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/reusable/SectionBackground.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c1 = SectionBackground;
var _c, _c1;
__turbopack_context__.k.register(_c, "StylizedPaper");
__turbopack_context__.k.register(_c1, "SectionBackground");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/utils/countries.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "countries",
    ()=>countries,
    "countryCodesSet",
    ()=>countryCodesSet,
    "getCountryName",
    ()=>getCountryName,
    "isCountryCode",
    ()=>isCountryCode
]);
const countries = [
    {
        code: "AD",
        nameEn: "Andorra",
        nameEs: "Andorra"
    },
    {
        code: "AE",
        nameEn: "United Arab Emirates",
        nameEs: "Emiratos Árabes Unidos"
    },
    {
        code: "AF",
        nameEn: "Afghanistan",
        nameEs: "Afganistán"
    },
    {
        code: "AG",
        nameEn: "Antigua and Barbuda",
        nameEs: "Antigua y Barbuda"
    },
    {
        code: "AI",
        nameEn: "Anguilla",
        nameEs: "Anguila"
    },
    {
        code: "AL",
        nameEn: "Albania",
        nameEs: "Albania"
    },
    {
        code: "AM",
        nameEn: "Armenia",
        nameEs: "Armenia"
    },
    {
        code: "AO",
        nameEn: "Angola",
        nameEs: "Angola"
    },
    {
        code: "AQ",
        nameEn: "Antarctica",
        nameEs: "Antártida"
    },
    {
        code: "AR",
        nameEn: "Argentina",
        nameEs: "Argentina"
    },
    {
        code: "AS",
        nameEn: "American Samoa",
        nameEs: "Samoa Americana"
    },
    {
        code: "AT",
        nameEn: "Austria",
        nameEs: "Austria"
    },
    {
        code: "AU",
        nameEn: "Australia",
        nameEs: "Australia"
    },
    {
        code: "AW",
        nameEn: "Aruba",
        nameEs: "Aruba"
    },
    {
        code: "AX",
        nameEn: "Åland Islands",
        nameEs: "Islas Åland"
    },
    {
        code: "AZ",
        nameEn: "Azerbaijan",
        nameEs: "Azerbaiyán"
    },
    {
        code: "BA",
        nameEn: "Bosnia and Herzegovina",
        nameEs: "Bosnia y Herzegovina"
    },
    {
        code: "BB",
        nameEn: "Barbados",
        nameEs: "Barbados"
    },
    {
        code: "BD",
        nameEn: "Bangladesh",
        nameEs: "Bangladesh"
    },
    {
        code: "BE",
        nameEn: "Belgium",
        nameEs: "Bélgica"
    },
    {
        code: "BF",
        nameEn: "Burkina Faso",
        nameEs: "Burkina Faso"
    },
    {
        code: "BG",
        nameEn: "Bulgaria",
        nameEs: "Bulgaria"
    },
    {
        code: "BH",
        nameEn: "Bahrain",
        nameEs: "Baréin"
    },
    {
        code: "BI",
        nameEn: "Burundi",
        nameEs: "Burundi"
    },
    {
        code: "BJ",
        nameEn: "Benin",
        nameEs: "Benín"
    },
    {
        code: "BL",
        nameEn: "Saint Barthélemy",
        nameEs: "San Bartolomé"
    },
    {
        code: "BM",
        nameEn: "Bermuda",
        nameEs: "Bermudas"
    },
    {
        code: "BN",
        nameEn: "Brunei",
        nameEs: "Brunéi"
    },
    {
        code: "BO",
        nameEn: "Bolivia",
        nameEs: "Bolivia"
    },
    {
        code: "BQ",
        nameEn: "Caribbean Netherlands",
        nameEs: "Caribe Neerlandés"
    },
    {
        code: "BR",
        nameEn: "Brazil",
        nameEs: "Brasil"
    },
    {
        code: "BS",
        nameEn: "Bahamas",
        nameEs: "Bahamas"
    },
    {
        code: "BT",
        nameEn: "Bhutan",
        nameEs: "Bután"
    },
    {
        code: "BV",
        nameEn: "Bouvet Island",
        nameEs: "Isla Bouvet"
    },
    {
        code: "BW",
        nameEn: "Botswana",
        nameEs: "Botsuana"
    },
    {
        code: "BY",
        nameEn: "Belarus",
        nameEs: "Bielorrusia"
    },
    {
        code: "BZ",
        nameEn: "Belize",
        nameEs: "Belice"
    },
    {
        code: "CA",
        nameEn: "Canada",
        nameEs: "Canadá"
    },
    {
        code: "CC",
        nameEn: "Cocos Islands",
        nameEs: "Islas Cocos"
    },
    {
        code: "CD",
        nameEn: "Democratic Republic of the Congo",
        nameEs: "República Democrática del Congo"
    },
    {
        code: "CF",
        nameEn: "Central African Republic",
        nameEs: "República Centroafricana"
    },
    {
        code: "CG",
        nameEn: "Republic of the Congo",
        nameEs: "República del Congo"
    },
    {
        code: "CH",
        nameEn: "Switzerland",
        nameEs: "Suiza"
    },
    {
        code: "CI",
        nameEn: "Ivory Coast",
        nameEs: "Costa de Marfil"
    },
    {
        code: "CK",
        nameEn: "Cook Islands",
        nameEs: "Islas Cook"
    },
    {
        code: "CL",
        nameEn: "Chile",
        nameEs: "Chile"
    },
    {
        code: "CM",
        nameEn: "Cameroon",
        nameEs: "Camerún"
    },
    {
        code: "CN",
        nameEn: "China",
        nameEs: "China"
    },
    {
        code: "CO",
        nameEn: "Colombia",
        nameEs: "Colombia"
    },
    {
        code: "CR",
        nameEn: "Costa Rica",
        nameEs: "Costa Rica"
    },
    {
        code: "CU",
        nameEn: "Cuba",
        nameEs: "Cuba"
    },
    {
        code: "CV",
        nameEn: "Cape Verde",
        nameEs: "Cabo Verde"
    },
    {
        code: "CW",
        nameEn: "Curaçao",
        nameEs: "Curazao"
    },
    {
        code: "CX",
        nameEn: "Christmas Island",
        nameEs: "Isla de Navidad"
    },
    {
        code: "CY",
        nameEn: "Cyprus",
        nameEs: "Chipre"
    },
    {
        code: "CZ",
        nameEn: "Czech Republic",
        nameEs: "República Checa"
    },
    {
        code: "DE",
        nameEn: "Germany",
        nameEs: "Alemania"
    },
    {
        code: "DJ",
        nameEn: "Djibouti",
        nameEs: "Yibuti"
    },
    {
        code: "DK",
        nameEn: "Denmark",
        nameEs: "Dinamarca"
    },
    {
        code: "DM",
        nameEn: "Dominica",
        nameEs: "Dominica"
    },
    {
        code: "DO",
        nameEn: "Dominican Republic",
        nameEs: "República Dominicana"
    },
    {
        code: "DZ",
        nameEn: "Algeria",
        nameEs: "Argelia"
    },
    {
        code: "EC",
        nameEn: "Ecuador",
        nameEs: "Ecuador"
    },
    {
        code: "EE",
        nameEn: "Estonia",
        nameEs: "Estonia"
    },
    {
        code: "EG",
        nameEn: "Egypt",
        nameEs: "Egipto"
    },
    {
        code: "EH",
        nameEn: "Western Sahara",
        nameEs: "Sahara Occidental"
    },
    {
        code: "ER",
        nameEn: "Eritrea",
        nameEs: "Eritrea"
    },
    {
        code: "ES",
        nameEn: "Spain",
        nameEs: "España"
    },
    {
        code: "ET",
        nameEn: "Ethiopia",
        nameEs: "Etiopía"
    },
    {
        code: "FI",
        nameEn: "Finland",
        nameEs: "Finlandia"
    },
    {
        code: "FJ",
        nameEn: "Fiji",
        nameEs: "Fiyi"
    },
    {
        code: "FK",
        nameEn: "Falkland Islands",
        nameEs: "Islas Malvinas"
    },
    {
        code: "FM",
        nameEn: "Micronesia",
        nameEs: "Micronesia"
    },
    {
        code: "FO",
        nameEn: "Faroe Islands",
        nameEs: "Islas Feroe"
    },
    {
        code: "FR",
        nameEn: "France",
        nameEs: "Francia"
    },
    {
        code: "GA",
        nameEn: "Gabon",
        nameEs: "Gabón"
    },
    {
        code: "GB",
        nameEn: "United Kingdom",
        nameEs: "Reino Unido"
    },
    {
        code: "GD",
        nameEn: "Grenada",
        nameEs: "Granada"
    },
    {
        code: "GE",
        nameEn: "Georgia",
        nameEs: "Georgia"
    },
    {
        code: "GF",
        nameEn: "French Guiana",
        nameEs: "Guayana Francesa"
    },
    {
        code: "GG",
        nameEn: "Guernsey",
        nameEs: "Guernsey"
    },
    {
        code: "GH",
        nameEn: "Ghana",
        nameEs: "Ghana"
    },
    {
        code: "GI",
        nameEn: "Gibraltar",
        nameEs: "Gibraltar"
    },
    {
        code: "GL",
        nameEn: "Greenland",
        nameEs: "Groenlandia"
    },
    {
        code: "GM",
        nameEn: "Gambia",
        nameEs: "Gambia"
    },
    {
        code: "GN",
        nameEn: "Guinea",
        nameEs: "Guinea"
    },
    {
        code: "GP",
        nameEn: "Guadeloupe",
        nameEs: "Guadalupe"
    },
    {
        code: "GQ",
        nameEn: "Equatorial Guinea",
        nameEs: "Guinea Ecuatorial"
    },
    {
        code: "GR",
        nameEn: "Greece",
        nameEs: "Grecia"
    },
    {
        code: "GS",
        nameEn: "South Georgia and South Sandwich Islands",
        nameEs: "Georgia del Sur y las Islas Sandwich del Sur"
    },
    {
        code: "GT",
        nameEn: "Guatemala",
        nameEs: "Guatemala"
    },
    {
        code: "GU",
        nameEn: "Guam",
        nameEs: "Guam"
    },
    {
        code: "GW",
        nameEn: "Guinea-Bissau",
        nameEs: "Guinea-Bisáu"
    },
    {
        code: "GY",
        nameEn: "Guyana",
        nameEs: "Guyana"
    },
    {
        code: "HK",
        nameEn: "Hong Kong",
        nameEs: "Hong Kong"
    },
    {
        code: "HM",
        nameEn: "Heard Island and McDonald Islands",
        nameEs: "Islas Heard y McDonald"
    },
    {
        code: "HN",
        nameEn: "Honduras",
        nameEs: "Honduras"
    },
    {
        code: "HR",
        nameEn: "Croatia",
        nameEs: "Croacia"
    },
    {
        code: "HT",
        nameEn: "Haiti",
        nameEs: "Haití"
    },
    {
        code: "HU",
        nameEn: "Hungary",
        nameEs: "Hungría"
    },
    {
        code: "ID",
        nameEn: "Indonesia",
        nameEs: "Indonesia"
    },
    {
        code: "IE",
        nameEn: "Ireland",
        nameEs: "Irlanda"
    },
    {
        code: "IL",
        nameEn: "Israel",
        nameEs: "Israel"
    },
    {
        code: "IM",
        nameEn: "Isle of Man",
        nameEs: "Isla de Man"
    },
    {
        code: "IN",
        nameEn: "India",
        nameEs: "India"
    },
    {
        code: "IO",
        nameEn: "British Indian Ocean Territory",
        nameEs: "Territorio Británico del Océano Índico"
    },
    {
        code: "IQ",
        nameEn: "Iraq",
        nameEs: "Irak"
    },
    {
        code: "IR",
        nameEn: "Iran",
        nameEs: "Irán"
    },
    {
        code: "IS",
        nameEn: "Iceland",
        nameEs: "Islandia"
    },
    {
        code: "IT",
        nameEn: "Italy",
        nameEs: "Italia"
    },
    {
        code: "JE",
        nameEn: "Jersey",
        nameEs: "Jersey"
    },
    {
        code: "JM",
        nameEn: "Jamaica",
        nameEs: "Jamaica"
    },
    {
        code: "JO",
        nameEn: "Jordan",
        nameEs: "Jordania"
    },
    {
        code: "JP",
        nameEn: "Japan",
        nameEs: "Japón"
    },
    {
        code: "KE",
        nameEn: "Kenya",
        nameEs: "Kenia"
    },
    {
        code: "KG",
        nameEn: "Kyrgyzstan",
        nameEs: "Kirguistán"
    },
    {
        code: "KH",
        nameEn: "Cambodia",
        nameEs: "Camboya"
    },
    {
        code: "KI",
        nameEn: "Kiribati",
        nameEs: "Kiribati"
    },
    {
        code: "KM",
        nameEn: "Comoros",
        nameEs: "Comoras"
    },
    {
        code: "KN",
        nameEn: "Saint Kitts and Nevis",
        nameEs: "San Cristóbal y Nieves"
    },
    {
        code: "KP",
        nameEn: "North Korea",
        nameEs: "Corea del Norte"
    },
    {
        code: "KR",
        nameEn: "South Korea",
        nameEs: "Corea del Sur"
    },
    {
        code: "KW",
        nameEn: "Kuwait",
        nameEs: "Kuwait"
    },
    {
        code: "KY",
        nameEn: "Cayman Islands",
        nameEs: "Islas Caimán"
    },
    {
        code: "KZ",
        nameEn: "Kazakhstan",
        nameEs: "Kazajistán"
    },
    {
        code: "LA",
        nameEn: "Laos",
        nameEs: "Laos"
    },
    {
        code: "LB",
        nameEn: "Lebanon",
        nameEs: "Líbano"
    },
    {
        code: "LC",
        nameEn: "Saint Lucia",
        nameEs: "Santa Lucía"
    },
    {
        code: "LI",
        nameEn: "Liechtenstein",
        nameEs: "Liechtenstein"
    },
    {
        code: "LK",
        nameEn: "Sri Lanka",
        nameEs: "Sri Lanka"
    },
    {
        code: "LR",
        nameEn: "Liberia",
        nameEs: "Liberia"
    },
    {
        code: "LS",
        nameEn: "Lesotho",
        nameEs: "Lesoto"
    },
    {
        code: "LT",
        nameEn: "Lithuania",
        nameEs: "Lituania"
    },
    {
        code: "LU",
        nameEn: "Luxembourg",
        nameEs: "Luxemburgo"
    },
    {
        code: "LV",
        nameEn: "Latvia",
        nameEs: "Letonia"
    },
    {
        code: "LY",
        nameEn: "Libya",
        nameEs: "Libia"
    },
    {
        code: "MA",
        nameEn: "Morocco",
        nameEs: "Marruecos"
    },
    {
        code: "MC",
        nameEn: "Monaco",
        nameEs: "Mónaco"
    },
    {
        code: "MD",
        nameEn: "Moldova",
        nameEs: "Moldavia"
    },
    {
        code: "ME",
        nameEn: "Montenegro",
        nameEs: "Montenegro"
    },
    {
        code: "MF",
        nameEn: "Saint Martin",
        nameEs: "San Martín"
    },
    {
        code: "MG",
        nameEn: "Madagascar",
        nameEs: "Madagascar"
    },
    {
        code: "MH",
        nameEn: "Marshall Islands",
        nameEs: "Islas Marshall"
    },
    {
        code: "MK",
        nameEn: "North Macedonia",
        nameEs: "Macedonia del Norte"
    },
    {
        code: "ML",
        nameEn: "Mali",
        nameEs: "Malí"
    },
    {
        code: "MM",
        nameEn: "Myanmar",
        nameEs: "Myanmar"
    },
    {
        code: "MN",
        nameEn: "Mongolia",
        nameEs: "Mongolia"
    },
    {
        code: "MO",
        nameEn: "Macao",
        nameEs: "Macao"
    },
    {
        code: "MP",
        nameEn: "Northern Mariana Islands",
        nameEs: "Islas Marianas del Norte"
    },
    {
        code: "MQ",
        nameEn: "Martinique",
        nameEs: "Martinica"
    },
    {
        code: "MR",
        nameEn: "Mauritania",
        nameEs: "Mauritania"
    },
    {
        code: "MS",
        nameEn: "Montserrat",
        nameEs: "Montserrat"
    },
    {
        code: "MT",
        nameEn: "Malta",
        nameEs: "Malta"
    },
    {
        code: "MU",
        nameEn: "Mauritius",
        nameEs: "Mauricio"
    },
    {
        code: "MV",
        nameEn: "Maldives",
        nameEs: "Maldivas"
    },
    {
        code: "MW",
        nameEn: "Malawi",
        nameEs: "Malaui"
    },
    {
        code: "MX",
        nameEn: "Mexico",
        nameEs: "México"
    },
    {
        code: "MY",
        nameEn: "Malaysia",
        nameEs: "Malasia"
    },
    {
        code: "MZ",
        nameEn: "Mozambique",
        nameEs: "Mozambique"
    },
    {
        code: "NA",
        nameEn: "Namibia",
        nameEs: "Namibia"
    },
    {
        code: "NC",
        nameEn: "New Caledonia",
        nameEs: "Nueva Caledonia"
    },
    {
        code: "NE",
        nameEn: "Niger",
        nameEs: "Níger"
    },
    {
        code: "NF",
        nameEn: "Norfolk Island",
        nameEs: "Isla Norfolk"
    },
    {
        code: "NG",
        nameEn: "Nigeria",
        nameEs: "Nigeria"
    },
    {
        code: "NI",
        nameEn: "Nicaragua",
        nameEs: "Nicaragua"
    },
    {
        code: "NL",
        nameEn: "Netherlands",
        nameEs: "Países Bajos"
    },
    {
        code: "NO",
        nameEn: "Norway",
        nameEs: "Noruega"
    },
    {
        code: "NP",
        nameEn: "Nepal",
        nameEs: "Nepal"
    },
    {
        code: "NR",
        nameEn: "Nauru",
        nameEs: "Nauru"
    },
    {
        code: "NU",
        nameEn: "Niue",
        nameEs: "Niue"
    },
    {
        code: "NZ",
        nameEn: "New Zealand",
        nameEs: "Nueva Zelanda"
    },
    {
        code: "OM",
        nameEn: "Oman",
        nameEs: "Omán"
    },
    {
        code: "PA",
        nameEn: "Panama",
        nameEs: "Panamá"
    },
    {
        code: "PE",
        nameEn: "Peru",
        nameEs: "Perú"
    },
    {
        code: "PF",
        nameEn: "French Polynesia",
        nameEs: "Polinesia Francesa"
    },
    {
        code: "PG",
        nameEn: "Papua New Guinea",
        nameEs: "Papúa Nueva Guinea"
    },
    {
        code: "PH",
        nameEn: "Philippines",
        nameEs: "Filipinas"
    },
    {
        code: "PK",
        nameEn: "Pakistan",
        nameEs: "Pakistán"
    },
    {
        code: "PL",
        nameEn: "Poland",
        nameEs: "Polonia"
    },
    {
        code: "PM",
        nameEn: "Saint Pierre and Miquelon",
        nameEs: "San Pedro y Miquelón"
    },
    {
        code: "PN",
        nameEn: "Pitcairn Islands",
        nameEs: "Islas Pitcairn"
    },
    {
        code: "PR",
        nameEn: "Puerto Rico",
        nameEs: "Puerto Rico"
    },
    {
        code: "PS",
        nameEn: "Palestine",
        nameEs: "Palestina"
    },
    {
        code: "PT",
        nameEn: "Portugal",
        nameEs: "Portugal"
    },
    {
        code: "PW",
        nameEn: "Palau",
        nameEs: "Palaos"
    },
    {
        code: "PY",
        nameEn: "Paraguay",
        nameEs: "Paraguay"
    },
    {
        code: "QA",
        nameEn: "Qatar",
        nameEs: "Catar"
    },
    {
        code: "RE",
        nameEn: "Réunion",
        nameEs: "Reunión"
    },
    {
        code: "RO",
        nameEn: "Romania",
        nameEs: "Rumania"
    },
    {
        code: "RS",
        nameEn: "Serbia",
        nameEs: "Serbia"
    },
    {
        code: "RU",
        nameEn: "Russia",
        nameEs: "Rusia"
    },
    {
        code: "RW",
        nameEn: "Rwanda",
        nameEs: "Ruanda"
    },
    {
        code: "SA",
        nameEn: "Saudi Arabia",
        nameEs: "Arabia Saudita"
    },
    {
        code: "SB",
        nameEn: "Solomon Islands",
        nameEs: "Islas Salomón"
    },
    {
        code: "SC",
        nameEn: "Seychelles",
        nameEs: "Seychelles"
    },
    {
        code: "SD",
        nameEn: "Sudan",
        nameEs: "Sudán"
    },
    {
        code: "SE",
        nameEn: "Sweden",
        nameEs: "Suecia"
    },
    {
        code: "SG",
        nameEn: "Singapore",
        nameEs: "Singapur"
    },
    {
        code: "SH",
        nameEn: "Saint Helena",
        nameEs: "Santa Elena"
    },
    {
        code: "SI",
        nameEn: "Slovenia",
        nameEs: "Eslovenia"
    },
    {
        code: "SJ",
        nameEn: "Svalbard and Jan Mayen",
        nameEs: "Svalbard y Jan Mayen"
    },
    {
        code: "SK",
        nameEn: "Slovakia",
        nameEs: "Eslovaquia"
    },
    {
        code: "SL",
        nameEn: "Sierra Leone",
        nameEs: "Sierra Leona"
    },
    {
        code: "SM",
        nameEn: "San Marino",
        nameEs: "San Marino"
    },
    {
        code: "SN",
        nameEn: "Senegal",
        nameEs: "Senegal"
    },
    {
        code: "SO",
        nameEn: "Somalia",
        nameEs: "Somalia"
    },
    {
        code: "SR",
        nameEn: "Suriname",
        nameEs: "Surinam"
    },
    {
        code: "SS",
        nameEn: "South Sudan",
        nameEs: "Sudán del Sur"
    },
    {
        code: "ST",
        nameEn: "São Tomé and Príncipe",
        nameEs: "Santo Tomé y Príncipe"
    },
    {
        code: "SV",
        nameEn: "El Salvador",
        nameEs: "El Salvador"
    },
    {
        code: "SX",
        nameEn: "Sint Maarten",
        nameEs: "San Martín"
    },
    {
        code: "SY",
        nameEn: "Syria",
        nameEs: "Siria"
    },
    {
        code: "SZ",
        nameEn: "Eswatini",
        nameEs: "Esuatini"
    },
    {
        code: "TC",
        nameEn: "Turks and Caicos Islands",
        nameEs: "Islas Turcas y Caicos"
    },
    {
        code: "TD",
        nameEn: "Chad",
        nameEs: "Chad"
    },
    {
        code: "TF",
        nameEn: "French Southern Territories",
        nameEs: "Territorios Australes Franceses"
    },
    {
        code: "TG",
        nameEn: "Togo",
        nameEs: "Togo"
    },
    {
        code: "TH",
        nameEn: "Thailand",
        nameEs: "Tailandia"
    },
    {
        code: "TJ",
        nameEn: "Tajikistan",
        nameEs: "Tayikistán"
    },
    {
        code: "TK",
        nameEn: "Tokelau",
        nameEs: "Tokelau"
    },
    {
        code: "TL",
        nameEn: "Timor-Leste",
        nameEs: "Timor Oriental"
    },
    {
        code: "TM",
        nameEn: "Turkmenistan",
        nameEs: "Turkmenistán"
    },
    {
        code: "TN",
        nameEn: "Tunisia",
        nameEs: "Túnez"
    },
    {
        code: "TO",
        nameEn: "Tonga",
        nameEs: "Tonga"
    },
    {
        code: "TR",
        nameEn: "Turkey",
        nameEs: "Turquía"
    },
    {
        code: "TT",
        nameEn: "Trinidad and Tobago",
        nameEs: "Trinidad y Tobago"
    },
    {
        code: "TV",
        nameEn: "Tuvalu",
        nameEs: "Tuvalu"
    },
    {
        code: "TW",
        nameEn: "Taiwan",
        nameEs: "Taiwán"
    },
    {
        code: "TZ",
        nameEn: "Tanzania",
        nameEs: "Tanzania"
    },
    {
        code: "UA",
        nameEn: "Ukraine",
        nameEs: "Ucrania"
    },
    {
        code: "UG",
        nameEn: "Uganda",
        nameEs: "Uganda"
    },
    {
        code: "UM",
        nameEn: "United States Minor Outlying Islands",
        nameEs: "Islas Ultramarinas Menores de Estados Unidos"
    },
    {
        code: "US",
        nameEn: "United States",
        nameEs: "Estados Unidos"
    },
    {
        code: "UY",
        nameEn: "Uruguay",
        nameEs: "Uruguay"
    },
    {
        code: "UZ",
        nameEn: "Uzbekistan",
        nameEs: "Uzbekistán"
    },
    {
        code: "VA",
        nameEn: "Vatican City",
        nameEs: "Ciudad del Vaticano"
    },
    {
        code: "VC",
        nameEn: "Saint Vincent and the Grenadines",
        nameEs: "San Vicente y las Granadinas"
    },
    {
        code: "VE",
        nameEn: "Venezuela",
        nameEs: "Venezuela"
    },
    {
        code: "VG",
        nameEn: "British Virgin Islands",
        nameEs: "Islas Vírgenes Británicas"
    },
    {
        code: "VI",
        nameEn: "U.S. Virgin Islands",
        nameEs: "Islas Vírgenes de los Estados Unidos"
    },
    {
        code: "VN",
        nameEn: "Vietnam",
        nameEs: "Vietnam"
    },
    {
        code: "VU",
        nameEn: "Vanuatu",
        nameEs: "Vanuatu"
    },
    {
        code: "WF",
        nameEn: "Wallis and Futuna",
        nameEs: "Wallis y Futuna"
    },
    {
        code: "WS",
        nameEn: "Samoa",
        nameEs: "Samoa"
    },
    {
        code: "YE",
        nameEn: "Yemen",
        nameEs: "Yemen"
    },
    {
        code: "YT",
        nameEn: "Mayotte",
        nameEs: "Mayotte"
    },
    {
        code: "ZA",
        nameEn: "South Africa",
        nameEs: "Sudáfrica"
    },
    {
        code: "ZM",
        nameEn: "Zambia",
        nameEs: "Zambia"
    },
    {
        code: "ZW",
        nameEn: "Zimbabwe",
        nameEs: "Zimbabue"
    }
];
const countryCodesSet = new Set(countries.map((c)=>c.code));
const isCountryCode = (code)=>{
    return countryCodesSet.has(code);
};
const getCountryName = (code, language)=>{
    const country = countries.find((c)=>c.code === code);
    if (!country) return null;
    return language === "en" ? country.nameEn : country.nameEs;
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/utils/excel.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createCellWithLineBreaks",
    ()=>createCellWithLineBreaks,
    "createWorksheet",
    ()=>createWorksheet,
    "generateExcel",
    ()=>generateExcel,
    "getSheetDataById",
    ()=>getSheetDataById,
    "getSheetDataByName",
    ()=>getSheetDataByName,
    "getUploadFileTemplatePath",
    ()=>getUploadFileTemplatePath,
    "loadExcelFileFarmsData",
    ()=>loadExcelFileFarmsData,
    "loadTemplateHeaders",
    ()=>loadTemplateHeaders,
    "readExcel",
    ()=>readExcel,
    "removeFirstNRow",
    ()=>removeFirstNRow,
    "sheetToJson",
    ()=>sheetToJson,
    "validateData",
    ()=>validateData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/xlsx@https+++cdn.sheetjs.com+xlsx-0.20.3+xlsx-0.20.3.tgz/node_modules/xlsx/xlsx.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$exceljs$40$4$2e$4$2e$0$2f$node_modules$2f$exceljs$2f$dist$2f$exceljs$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/exceljs@4.4.0/node_modules/exceljs/dist/exceljs.min.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$countries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/utils/countries.ts [app-client] (ecmascript)");
;
;
;
// TODO: refactor to use only the exceljs library
/**
 * Validates a single coordinate pair [longitude, latitude].
 * @param coord - The coordinate pair to validate
 * @returns boolean indicating if the coordinate is valid
 */ const isValidCoordinatePair = (coord)=>{
    if (!Array.isArray(coord) || coord.length !== 2) {
        return false;
    }
    // Both longitude and latitude must be numbers
    if (typeof coord[0] !== "number" || typeof coord[1] !== "number") {
        return false;
    }
    // Basic coordinate range validation
    if (coord[0] < -180 || coord[0] > 180 || coord[1] < -90 || coord[1] > 90) {
        return false;
    }
    return true;
};
/**
 * Validates a linear ring (array of coordinate pairs).
 * @param ring - The linear ring to validate
 * @returns boolean indicating if the ring is valid
 */ const isValidLinearRing = (ring)=>{
    if (!Array.isArray(ring) || ring.length < 4) {
        return false; // At least 4 points needed for a closed ring
    }
    // Each coordinate must be a valid coordinate pair
    for (const coord of ring){
        if (!isValidCoordinatePair(coord)) {
            return false;
        }
    }
    return true;
};
/**
 * Validates an array of linear rings.
 * @param rings - The array of linear rings to validate
 * @returns boolean indicating if all rings are valid
 */ const isValidLinearRings = (rings)=>{
    if (!Array.isArray(rings) || rings.length === 0) {
        return false;
    }
    // Each linear ring must be valid
    for (const ring of rings){
        if (!isValidLinearRing(ring)) {
            return false;
        }
    }
    return true;
};
/**
 * Validates WKT (Well-Known Text) coordinate format.
 * WKT format examples: POINT(-84.00230098 9.87830771), POLYGON((-84.02 9.83, -84.01 9.82, ...))
 * @param coordinates - The coordinate string to validate
 * @returns boolean indicating if the coordinates are valid WKT format
 */ const validateWKTCoordinates = (coordinates)=>{
    // Basic WKT validation - should start with geometry type and contain parentheses
    // const allWktRegex =
    //   /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i;
    const wktRegex = /^(POINT|POLYGON)\s*\(/i;
    return wktRegex.test(coordinates.trim());
};
/**
 * Validates GeoJSON Point coordinate format.
 * Format: [-84.00230098, 9.87830771]
 * @param coordinates - The coordinate string to validate
 * @returns boolean indicating if the coordinates are valid GeoJSON Point format
 */ const validateGeoJSONPointCoordinates = (coordinates)=>{
    // GeoJSON Point: [longitude, latitude] - exactly 2 numbers
    try {
        const parsed = JSON.parse(coordinates.trim());
        return isValidCoordinatePair(parsed);
    } catch  {
        return false;
    }
};
/**
 * Validates GeoJSON Polygon coordinate format.
 * Format: [[[-84.02, 9.83],[-84.01, 9.82],...]] - array of linear rings
 * @param coordinates - The coordinate string to validate
 * @returns boolean indicating if the coordinates are valid GeoJSON Polygon format
 */ const validateGeoJSONPolygonCoordinates = (coordinates)=>{
    try {
        const parsed = JSON.parse(coordinates.trim());
        // Must be an array of linear rings
        return isValidLinearRings(parsed);
    } catch  {
        return false; // Invalid JSON
    }
};
const createCellWithLineBreaks = (value)=>{
    return {
        v: value.split("\r\n").join(String.fromCharCode(13) + String.fromCharCode(10)),
        t: "s",
        s: {
            alignment: {
                wrapText: true,
                vertical: "center"
            }
        }
    };
    //TURBOPACK unreachable
    ;
    // Replace \n with the ASCII character for line feed (char 10)
    const valueWithChar10 = undefined;
    // Create XML with explicit line breaks
    const xmlValue = undefined;
};
const readExcel = async (file)=>{
    const reader = new FileReader();
    return new Promise((resolve, reject)=>{
        reader.onload = (event)=>{
            const binaryStr = event.target?.result;
            const workbook = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["read"](binaryStr, {
                type: "binary",
                cellDates: true,
                raw: true,
                cellText: true
            });
            resolve(workbook);
        };
        reader.onerror = (event)=>{
            reject(event);
        };
        reader.readAsArrayBuffer(file);
    });
};
const getSheetDataByName = (workbook, sheetName)=>{
    const sheetId = workbook.SheetNames.findIndex((name)=>name === sheetName);
    const sheet = workbook.Sheets[workbook.SheetNames[sheetId]];
    return sheet;
};
const getSheetDataById = (workbook, sheetId)=>{
    const sheet = workbook.Sheets[workbook.SheetNames[sheetId]];
    return sheet;
};
const sheetToJson = (sheet, options)=>{
    const defaultOptions = {
        blankrows: false,
        raw: true,
        defval: null,
        rawNumbers: true
    };
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils"].sheet_to_json(sheet, {
        ...defaultOptions,
        ...options
    });
};
const removeFirstNRow = (sheet, n)=>{
    if (!sheet["!ref"]) {
        throw new Error("Sheet is empty");
    }
    const range = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils"].decode_range(sheet["!ref"]);
    range.s.r = n;
    sheet["!ref"] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils"].encode_range(range);
    return sheet;
};
const createWorksheet = (data, merges)=>{
    const ws = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils"].aoa_to_sheet([]);
    // Process each row and cell to handle line breaks
    data.forEach((row, rowIndex)=>{
        row.forEach((cell, colIndex)=>{
            const cellRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils"].encode_cell({
                r: rowIndex,
                c: colIndex
            });
            // If it's already a cell object, use it as is
            if (cell && typeof cell === "object" && "v" in cell) {
                ws[cellRef] = cell;
            } else if (typeof cell === "string" && cell.includes("\n")) {
                ws[cellRef] = createCellWithLineBreaks(cell);
            } else {
                ws[cellRef] = {
                    v: cell
                };
            }
        });
    });
    // Set the ref attribute
    if (data.length > 0 && data[0].length > 0) {
        ws["!ref"] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils"].encode_range({
            s: {
                r: 0,
                c: 0
            },
            e: {
                r: data.length - 1,
                c: Math.max(...data.map((row)=>row.length)) - 1
            }
        });
    }
    // Apply merges if provided
    if (merges) {
        ws["!merges"] = merges;
    }
    // Set explicit column widths
    ws["!cols"] = [];
    for(let i = 0; i < (data[0]?.length || 0); i++){
        // Column with wrapped text should be wider
        ws["!cols"].push({
            wch: 25
        });
    }
    // Set explicit row heights for any row containing wrapped text
    ws["!rows"] = [];
    for(let i = 0; i < data.length; i++){
        const hasWrappedText = data[i].some((cell)=>typeof cell === "string" && cell.includes("\n"));
        if (hasWrappedText) {
            ws["!rows"][i] = {
                hpt: 40
            }; // Taller rows for wrapped text
        } else {
            ws["!rows"][i] = {
                hpt: 20
            }; // Standard height
        }
    }
    // Add a hidden cell with a formula that forces Excel to recalculate
    const hiddenCellRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils"].encode_cell({
        r: 0,
        c: 50
    });
    ws[hiddenCellRef] = {
        f: 'REPLACE("a","a","a")',
        t: "f",
        h: ""
    };
    return ws;
};
const generateExcel = async (data)=>{
    const workbook = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$exceljs$40$4$2e$4$2e$0$2f$node_modules$2f$exceljs$2f$dist$2f$exceljs$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Workbook();
    Object.entries(data).forEach(([sheetName, sheetData])=>{
        const worksheet = workbook.addWorksheet(sheetName);
        // Set column widths for first 20 columns
        worksheet.columns = Array(20).fill(null).map(()=>({
                width: 30
            }));
        // Add rows
        sheetData.rows.forEach((row, idx)=>{
            const excelRow = worksheet.addRow(row);
            // Set row height (in points)
            const hasWrappedText = row.some((cell)=>typeof cell === "string" && cell.includes("\n"));
            excelRow.height = hasWrappedText ? 25 : 16; // Taller rows for wrapped text
            for(let i = 0; i < row.length; i++){
                const cell = worksheet.getCell(idx + 1, i + 1);
                cell.alignment = {
                    wrapText: true,
                    vertical: "top"
                };
            }
            // Commit the changes to ensure they're applied
            excelRow.commit();
        });
        // Apply merges if any
        if (sheetData.merges) {
            sheetData.merges.forEach((merge)=>{
                worksheet.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1);
            });
        }
        // Apply bold formatting AFTER all rows are created and merged
        // This ensures it doesn't get overwritten by any other operations
        for(let rowIndex = 1; rowIndex <= 2; rowIndex++){
            const row = worksheet.getRow(rowIndex);
            row.eachCell({
                includeEmpty: true
            }, (cell)=>{
                // Create a completely new font object
                cell.font = {
                    bold: true,
                    name: "Calibri",
                    size: 12,
                    color: {
                        argb: "000000"
                    }
                };
            });
            row.commit();
        }
    });
    // Write to buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([
        buffer
    ], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    return blob;
};
const loadTemplateHeaders = async (locale)=>{
    // Path to your template in the public directory
    const templatePath = getUploadFileTemplatePath(locale);
    // Fetch the template file
    const response = await fetch(templatePath);
    if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
    }
    const templateArrayBuffer = await response.arrayBuffer();
    // Load the template workbook
    const templateWorkbook = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["read"](templateArrayBuffer, {
        type: "array"
    });
    // Get the first sheet name
    const firstSheetName = templateWorkbook.SheetNames[0];
    // Get the first worksheet
    const templateSheet = templateWorkbook.Sheets[firstSheetName];
    // Convert to JSON to easily extract header rows
    const templateData = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xlsx$40$https$2b2b2b$cdn$2e$sheetjs$2e$com$2b$xlsx$2d$0$2e$20$2e$3$2b$xlsx$2d$0$2e$20$2e$3$2e$tgz$2f$node_modules$2f$xlsx$2f$xlsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils"].sheet_to_json(templateSheet, {
        header: 1
    });
    // Extract the first 3 rows (headers)
    const headerRows = templateData.slice(0, 3);
    return headerRows;
};
const headerKeywordsMappings = {
    // attribute: [es-header, en-header]
    id: [
        "id",
        "id"
    ],
    producerName: [
        "nombre productor",
        "producer name"
    ],
    productionDate: [
        "fecha producción",
        "production date"
    ],
    productionQuantity: [
        "cantidad producción",
        "production quantity"
    ],
    productionQuantityUnit: [
        "unidad cantidad producción",
        "production measurement unit"
    ],
    country: [
        "país",
        "country"
    ],
    region: [
        "región",
        "region"
    ],
    coordinatesFormat: [
        "formato coordenadas",
        "coordinates format"
    ],
    geometryType: [
        "tipo geometría",
        "geometry type"
    ],
    farmCoordinates: [
        "coordenadas finca",
        "land coordinates"
    ],
    area: [
        "superficie [hectáreas]",
        "area [hectares]"
    ],
    cropType: [
        "tipo de cultivo",
        "crop type"
    ],
    association: [
        "asociación",
        "cooperative"
    ],
    documentName1: [
        "nombre documento 1",
        "document name 1"
    ],
    documentUrl1: [
        "enlace documento 1",
        "document link 1"
    ],
    documentName2: [
        "nombre documento 2",
        "document name 2"
    ],
    documentUrl2: [
        "enlace documento 2",
        "document link 2"
    ],
    documentName3: [
        "nombre documento 3",
        "document name 3"
    ],
    documentUrl3: [
        "enlace documento 3",
        "document link 3"
    ]
};
const mandatoryHeaders = [
    "producerName",
    "productionDate",
    "productionQuantity",
    "productionQuantityUnit",
    "country",
    "coordinatesFormat",
    "geometryType",
    "farmCoordinates",
    "cropType"
];
const validateData = ({ data, mandatoryHeaders, t, language })=>{
    const errorMessages = [];
    data.forEach((row, idx)=>{
        const rowIdx = idx + 4; // The template has 3 rows of headers, so we need to add 3 to the index for proper row numbering
        // Check if all mandatory headers are present in each row
        mandatoryHeaders.forEach((header)=>{
            if (!row[header]) {
                const errorMsg = t("common:parseFileError:mandatoryDataMissing", {
                    header: headerKeywordsMappings[header][language === "es" ? 0 : 1],
                    row: rowIdx
                });
                errorMessages.push(errorMsg);
            }
        });
        // Check if coordinates format is valid
        const validCoordinatesFormats = [
            "WKT",
            "GeoJSON"
        ];
        if (row["coordinatesFormat"] && !validCoordinatesFormats.includes(row["coordinatesFormat"])) {
            const errorMsg = t("common:parseFileError:invalidCoordinatesFormat", {
                row: rowIdx
            });
            errorMessages.push(errorMsg);
        }
        // Check if geometry type is valid
        const validGeometryTypes = [
            "Point",
            "Polygon"
        ];
        if (row["geometryType"] && !validGeometryTypes.includes(row["geometryType"])) {
            const errorMsg = t("common:parseFileError:invalidGeometryType", {
                row: rowIdx
            });
            errorMessages.push(errorMsg);
        }
        // Check if coordinates are valid based on format and geometry type
        if (row["geometryType"] && "farmCoordinates" in row && typeof row["farmCoordinates"] === "string") {
            const coordinatesFormat = row["coordinatesFormat"];
            const geometryType = row["geometryType"];
            const coordinates = row["farmCoordinates"];
            let isValidCoordinates = false;
            if (coordinatesFormat === "WKT") {
                isValidCoordinates = validateWKTCoordinates(coordinates);
            } else if (coordinatesFormat === "GeoJSON") {
                if (geometryType === "Point") {
                    isValidCoordinates = validateGeoJSONPointCoordinates(coordinates);
                } else if (geometryType === "Polygon") {
                    isValidCoordinates = validateGeoJSONPolygonCoordinates(coordinates);
                }
            }
            if (!isValidCoordinates) {
                const errorMsg = t("common:parseFileError:invalidCoordinates", {
                    row: rowIdx
                });
                errorMessages.push(errorMsg);
            }
        }
        // Check the country is ISO 3166-1 alpha-2
        const country = row["country"];
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$countries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isCountryCode"])(country)) {
            const errorMsg = t("common:parseFileError:invalidCountryCode", {
                row: rowIdx
            });
            throw new Error(errorMsg);
        }
    });
    return errorMessages;
};
/**
 * Parses an Excel worksheet to extract headers and data.
 *
 * @param {XLSX.WorkSheet} worksheet - The Excel worksheet to parse
 * @returns {{
 *   data: Record<string, string>[],
 *   headers: string[]
 * }} An object containing:
 *   - data: Array of records representing the worksheet data (excluding headers)
 *   - headers: Array of header strings from row 2 of the worksheet
 *
 * @remarks
 * This function:
 * - Extracts headers from row 2 (index 1) of the worksheet
 * - Removes the first row and returns remaining data as an array of records
 * - Assumes headers are in range A1:AA3 (3 header rows total)
 * - Returns data starting from row 4 (after skipping 3 header rows)
 * - Headers are taken from row 2 specifically, rows 1 and 3 are ignored
 */ const parseExcelData = (worksheet)=>{
    // Check mandatory headers
    const headersData = sheetToJson(worksheet, {
        range: "A1:AA3",
        header: 1
    });
    const headers = headersData[1];
    // Get all data
    const dataSheet = removeFirstNRow(worksheet, 1);
    return {
        data: sheetToJson(dataSheet).slice(1),
        headers
    };
};
const loadExcelFileFarmsData = async (file, t, language)=>{
    const excel = await readExcel(file);
    const worksheet = getSheetDataById(excel, 0);
    const { data, headers } = parseExcelData(worksheet);
    // Create a mapping from Excel header to our internal key
    const headerToKeyMap = {};
    Object.entries(headerKeywordsMappings).forEach(([internalKey, expectedHeaders])=>{
        headers.forEach((incomingHeader)=>{
            if (!incomingHeader) return;
            // Split header by newline and get the first part
            const cleanHeaderParts = incomingHeader.split(/\r?\n/).map((part)=>part.toLowerCase().trim());
            if (expectedHeaders.some((h)=>cleanHeaderParts.includes(h))) {
                headerToKeyMap[incomingHeader] = internalKey;
            }
        });
    });
    // Remapping data based on header keywords
    const mappedData = data.map((row)=>{
        const newRow = {
            documents: []
        };
        // Apply mapping to current row
        Object.entries(row).forEach(([excelHeader, value])=>{
            const internalKey = headerToKeyMap[excelHeader];
            if (internalKey) {
                newRow[internalKey] = value;
                // Trim the value if it's a string
                if (typeof newRow[internalKey] === "string") {
                    newRow[internalKey] = newRow[internalKey].trim();
                }
                // If the value is an empty string, set it to null
                if (newRow[internalKey] === "") {
                    newRow[internalKey] = null;
                }
            }
        });
        // Convert id to string if it's a number
        if (typeof newRow.id === "number") {
            newRow.id = newRow.id.toString();
        }
        // Convert productionDate to ISO string if it's a Date
        const dateValue = newRow.productionDate; // The package returns a Date object automatically
        if (dateValue instanceof Date) {
            newRow.productionDate = dateValue.toISOString();
        }
        return newRow;
    });
    // Consolidate the documents into an array
    mappedData.forEach((row)=>{
        row.documents = [];
        if (row.documentUrl1) {
            row.documents.push({
                name: row.documentName1 ?? "",
                url: row.documentUrl1
            });
        }
        if (row.documentUrl2) {
            row.documents.push({
                name: row.documentName2 ?? "",
                url: row.documentUrl2
            });
        }
        if (row.documentUrl3) {
            row.documents.push({
                name: row.documentName3 ?? "",
                url: row.documentUrl3
            });
        }
        delete row.documentName1;
        delete row.documentUrl1;
        delete row.documentName2;
        delete row.documentUrl2;
        delete row.documentName3;
        delete row.documentUrl3;
    });
    // Validate data
    const errorMessages = validateData({
        data: mappedData,
        mandatoryHeaders,
        t,
        language
    });
    return {
        data: mappedData,
        errorMessages
    };
};
const getUploadFileTemplatePath = (locale)=>{
    return `/files/m1-upload-file-template-${locale}.xlsx`;
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_1bph0-s._.js.map