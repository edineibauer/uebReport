var reports = [];

function getTrStyle(meta, value) {
    if (typeof meta !== "undefined") {
        let style = meta.datagrid.grid_style;
        if (meta.key === "source" && meta.size == 1 && value !== null && typeof value === "object" && typeof value[0] === "object" && typeof value[0].fileType === "string" && /^image\//.test(value[0].fileType)) {
            style += "background-image: url(" + value[0].image + ");"
        }
        return style
    }
    return ""
}

function updateGraficos() {
    return dbLocal.clear('__graficos').then(() => {
        return AJAX.get("graficos").then(r => {
            return dbLocal.exeCreate('__graficos', r);
        });
    });
}

function getGraficos() {
    return dbLocal.exeRead("__graficos", 1);
}

function getTrClass(meta, value) {
    if (typeof meta !== "undefined") {
        let classe = 'td-' + meta.format + " " + meta.datagrid.grid_class;
        if (meta.key === "source" && meta.size == 1 && value !== null && typeof value === "object" && typeof value[0] === "object" && typeof value[0].fileType === "string" && /^image\//.test(value[0].fileType)) {
            classe += " tableImgTd"
        }
        return classe
    }
    return ""
}

async function getTitleFromData(entity, data) {
    for(let typeColumn of (await dbLocal.exeRead("__relevant", 1))) {
        for(let col in dicionarios[entity]) {
            if(dicionarios[entity][col].format === typeColumn)
                return data[col];
        }
    }
}

async function gridTdFilterValue(value, meta, relationData) {
    if (typeof meta !== "undefined") {
        value = !isEmpty(value) ? value : "";

        if (['select', 'radio'].indexOf(meta.format) > -1) {
            value = meta.allow.options.find(option => option.valor == value).representacao;
        } else if ('checkbox' === meta.format) {
            let resposta = "";
            for (let i in meta.allow.options)
                resposta += (value.indexOf(meta.allow.options[i].valor.toString()) > -1 ? ((resposta !== "" ? ", " : "") + meta.allow.options[i].representacao) : "");

            value = resposta;
        } else if (meta.group === "boolean") {
            value = "<div class='activeBoolean" + (value == 1 ? " active" : "") + "'></div>";
        } else if (meta.key === "valor") {
            value = "R$ " + formatMoney(value, 2, ',', '.');
        } else if (meta.type === "float" || meta.type === "decimal") {
            value = !isEmpty(value) ? formatMoney(value, 2, ',', '.') : 0;
        } else if (['folder', 'extend'].indexOf(meta.format) > -1) {
            value = getRelevantTitle(meta.relation, value, 1, !1)
        } else if (['list', 'selecao', 'checkbox_rel', 'checkbox_mult'].indexOf(meta.format) > -1) {
            value = (!isEmpty(relationData) && !isEmpty(relationData[meta.column]) ? (await getTitleFromData(meta.relation, relationData[meta.column])) : "");
        } else {
            value = applyFilterToTd(value, meta)
        }
    }

    return value;
}

function applyFilterToTd(value, meta) {
    if (!isEmpty(meta.allow.options) && meta.key !== 'source') {
        $.each(meta.allow.options, function (i, e) {
            if (e.option == value) {
                value = e.name;
                return !1
            }
        })
    } else if (meta.format === 'date') {
        if (/-/.test(value)) {
            let v = value.split('-');
            value = v[2] + "/" + v[1] + "/" + v[0]
        }
    } else if (meta.format === 'datetime') {
        if (/T/.test(value)) {
            let b = value.split('T');
            let v = b[0].split('-');
            value = v[2] + "/" + v[1] + "/" + v[0] + " " + b[1]
        } else if (/ /.test(value)) {
            let b = value.split(' ');
            let v = b[0].split('-');
            value = v[2] + "/" + v[1] + "/" + v[0] + " " + b[1]
        }
    } else if (meta.key === 'source') {
        if (meta.key === "source" && meta.size == 1 && value !== null && typeof value === "object" && typeof value[0] === "object" && typeof value[0].fileType === "string" && /^image\//.test(value[0].fileType)) {
            value = ""
        } else {
            value = "<svg class='icon svgIcon' ><use xlink:href='#file'></use></svg>"
        }
    }
    return value
}

function reverse(s) {
    if (typeof s === "string")
        return s.split("").reverse().join("");
    return ""
}

function separaNumeroValor(val, charact) {
    charact = charact || " ";
    val = reverse(val);
    return reverse(val.substring(0, 3) + (val.substring(3, 6) !== "" ? charact + val.substring(3, 6) : "") + (val.substring(6, 9) !== "" ? charact + val.substring(6, 9) : "") + (val.substring(9, 12) !== "" ? charact + val.substring(9, 12) : "") + (val.substring(12, 15) !== "" ? charact + val.substring(12, 15) : "") + (val.substring(15, 18) !== "" ? charact + val.substring(15, 18) : ""))
}

function loadMaskTable($table) {
    // maskData($table)
}

async function reportTr(identificador, entity, data, fields) {
    let fieldsWorked = [];

    for(let e of fields) {
        if (typeof data[e.column] === "undefined")
            continue;

        fieldsWorked.push({
            id: data.id,
            column: e.column,
            show: e.show,
            entity: entity,
            style: getTrStyle(dicionarios[entity][e.column], data[e.column]),
            class: getTrClass(dicionarios[entity][e.column], data[e.column]),
            checked: !1,
            first: e.first,
            value: (await gridTdFilterValue(data[e.column], dicionarios[entity][e.column], data.relationData))
        });
    }

    return {
        id: data.id || 0,
        online: navigator.onLine,
        identificador: identificador,
        entity: entity,
        fields: fieldsWorked
    };
}

function reportTable(dataReport, $element) {
    let identificador = Math.floor((Math.random() * 1000)) + "" + Date.now();

    reports = [];
    let report = reports[identificador] = {
        identificador: identificador,
        id: dataReport.id,
        nome: dataReport.nome,
        entity: dataReport.entidade,
        data: {},
        dateStart: "1900-01-01",
        dateEnd: "2900-01-01",
        interval: 'month',
        $element: $element,
        $content: "",
        total: 0,
        limit: (localStorage.limitGrid ? parseInt(localStorage.limitGrid) : 15),
        page: 1,
        search: dataReport.search,
        filterAggroup: dataReport.agrupamento,
        filterAggroupSum: isEmpty(dataReport.soma) ? [] : JSON.parse(dataReport.soma),
        filterAggroupMedia: isEmpty(dataReport.media) ? [] : JSON.parse(dataReport.media),
        filterAggroupMaior: isEmpty(dataReport.maior) ? [] : JSON.parse(dataReport.maior),
        filterAggroupMenor: isEmpty(dataReport.menor) ? [] : JSON.parse(dataReport.menor),
        selecionados: [],
        order: dataReport.ordem,
        orderPosition: dataReport.decrescente,
        report: dataReport.regras,
        historic: 0,
        loadingTime: null,
        loadingHtml: null,
        fields: !isEmpty(dataReport.fields) ? JSON.parse(dataReport.fields) : [],

        setFields: function (fields) {
            this.fields = fields;
        },

        goodName: function () {
            return function (text, render) {
                return ucFirst(replaceAll(replaceAll(render(text), "_", " "), "-", " "))
            }
        },

        putWaitingRegisters: function (registerPosition, registersWaitingPosition, $content) {
            if (registersWaitingPosition.length) {
                for (let i in registersWaitingPosition) {
                    if (registersWaitingPosition[i].position === registerPosition) {
                        $content.append(registersWaitingPosition[i].content);
                        registerPosition++;
                        registersWaitingPosition.splice(i, 1);
                        return this.putWaitingRegisters(registerPosition, registersWaitingPosition, $content)
                    }
                }
            }
            return [registerPosition, registersWaitingPosition]
        },

        applyFilters: function () {
            let $this = this;
            $this.readData()
        },

        setNoRegister: function () {
            this.$content.parent().find("thead").addClass("hide");
            $("<div class='color-text-gray-dark font-xlarge font-light color-white padding-48 align-center table-info-result'><p class='margin-bottom' style='margin-top: 0;'><i class='material-icons font-xxlarge color-text-gray-dark'>priority_high</i></p>sem registros</div>").insertAfter(this.$content.parent());
        },

        setTotalRegisters: function (totalResults) {
            let totalFormated = "";
            let total = totalResults.toString();
            let le = total.length;
            for (let i = 0; i < le; i++)
                totalFormated += (i > 0 && (le - i) % 3 === 0 ? "." : "") + total[i];

            this.$element.find(".total").html(totalFormated + " resultado" + (totalFormated > 1 ? "s" : ""));
        },

        setLoading: function () {
            let $this = this;
            $this.loadingHtml = $("<div class='col' id='tr-loading' style='position: relative;height: 4px;'></div>").insertAfter(this.$element.find(".table-all"));
            $this.loadingHtml.loading();
            $this.loadingTime = setInterval(function () {
                $this.loadingHtml.loading()
            }, 2000);
        },

        removeLoading: function () {
            this.loadingHtml.remove();
            clearInterval(this.loadingTime)
        },

        readData: async function () {
            let $this = this;
            $this.$content = $this.$element.find("tbody");
            $(".table-info-result").remove();
            $this.$content.parent().find("thead").removeClass("hide");

            this.setLoading();

            let offset = ($this.page * $this.limit) - $this.limit;
            let result = await exeReadEntity($this.entity, $this.search, $this.report, $this.filterAggroup, $this.filterAggroupSum, $this.filterAggroupMedia, $this.filterAggroupMaior, $this.filterAggroupMenor, $this.order, $this.orderPosition, $this.limit, offset);
            result = {data: result, length: result.length === $this.limit ? result.length + 1 : result.length};
            let templates = getTemplates();

            $this.setTotalRegisters(result.length);
            $this.$content.html("");

            dbLocal.exeRead('__historic', 1).then(hist => {
                $this.historic = hist[$this.entity]
            });

            let pp = [];
            let registerPosition = 0;
            let registersWaitingPosition = [];
            for (let k in result.data) {
                if (typeof result.data[k] === "object" && !isEmpty(result.data[k])) {

                    pp.push(reportTr($this.identificador, $this.entity, result.data[k], $this.fields).then(tr => {
                        if (parseInt(k) === registerPosition) {
                            $this.$content.append(Mustache.render(templates.report_table_content, tr));
                            registerPosition++;
                            if (registersWaitingPosition.length) {
                                let r = $this.putWaitingRegisters(registerPosition, registersWaitingPosition, $this.$content);
                                registerPosition = r[0];
                                registersWaitingPosition = r[1]
                            }
                        } else {
                            registersWaitingPosition.push({
                                position: parseInt(k),
                                content: Mustache.render(templates.report_table_content, tr)
                            })
                        }
                    }))
                }
            }

            return Promise.all(pp).then(d => {
                if (isEmpty(d))
                    $this.setNoRegister();

                $this.removeLoading();
                loadMaskTable(this.$content);

                this.$element.find(".pagination").remove();
                let total = parseInt(this.$element.find(".total").html().replace(".", "").replace(".", "").replace(".", ""));
                if (total > this.limit) {
                    let $this = this;
                    $this.$element.find(".grid-form-body").materializePagination({
                        currentPage: $this.page,
                        lastPage: Math.ceil(total / $this.limit),
                        onClickCallback: function (requestedPage) {
                            if (requestedPage !== $this.page) {
                                $this.page = requestedPage;
                                $this.readData()
                            }
                        }
                    })
                }
            })
        },

        getShow: function () {
            var fields = (isEmpty(report.fields) ? getFields(report.entity, !0, 'report') : Promise.all([]));
            return Promise.all([fields]).then(r => {
                if (isEmpty(report.fields))
                    this.fields = r[0];

                if(!this.fields.find(f => f.column === "contagem")) {
                    this.fields.unshift({
                        class: "",
                        column: "contagem",
                        first: true,
                        format: "number",
                        nome: "total de registros",
                        relation: null,
                        show: true,
                        style: "",
                        template: ""
                    });
                }

                let templates = getTemplates();
                return Mustache.render(templates.report_table, {
                    entity: report.entity,
                    title: report.nome,
                    home: HOME,
                    limits: {
                        a: this.limit === 15,
                        b: this.limit === 25,
                        c: this.limit === 50,
                        d: this.limit === 100,
                        e: this.limit === 250,
                        f: this.limit === 500,
                        g: this.limit === 1000
                    },
                    identificador: this.identificador,
                    total: 0,
                    fields: this.fields
                })
            })
        },

        show: function () {
            return this.getShow().then(reportData => {
                this.$element.html(reportData);
                return this.readData();
            })
        },

        destroy: function () {
            clearInterval(syncGrid);
            this.$element.html("");
            delete (grids[this.identificador])
        }
    };

    /**
     * Mostra o relatório
     */
    report.show();

    return report;
}

function goMessage(colunaUsuario, id, selecionados) {
    pageTransition("enviar_mensagem", "form", "forward", "#report").then(() => {
        form.data.relatorio = id;
        form.data.selecionados = selecionados;
        form.data.coluna_do_usuario = colunaUsuario[0];
        form.data.entidade_do_usuario = colunaUsuario[1];
    });
}

function privateChartGetNumberDaysMonth(month) {
    if (month === 1)
        return 28;

    if ([3, 5, 8, 10].indexOf(month) > -1)
        return 30;

    return 31;
}


/**
 * Busca campo data com controle de nível de relevância
 * @param report
 * @returns {string}
 */
function findColumnDate(entity) {
    let colunaDate = "";
    let nivelColunaDate = -1;
    for (let column in dicionarios[entity]) {
        if (dicionarios[entity][column].format === "datetime") {
            if (column.indexOf("cadastro") > -1) {
                if (nivelColunaDate < 5) {
                    colunaDate = column;
                    nivelColunaDate = 5;
                }
            } else if (column === "data" || column === "date") {
                if (nivelColunaDate < 3) {
                    colunaDate = column;
                    nivelColunaDate = 3;
                }
            } else {
                if (nivelColunaDate < 1) {
                    colunaDate = column;
                    nivelColunaDate = 1;
                }
            }

        } else if (dicionarios[entity][column].format === "date") {
            if (column.indexOf("cadastro") > -1) {
                if (nivelColunaDate < 4) {
                    colunaDate = column;
                    nivelColunaDate = 4;
                }
            } else if (column === "data" || column === "date") {
                if (nivelColunaDate < 2) {
                    colunaDate = column;
                    nivelColunaDate = 2;
                }
            } else {
                if (nivelColunaDate < 0) {
                    colunaDate = column;
                    nivelColunaDate = 0;
                }
            }
        }
    }
    return colunaDate;
}

function readGraficosTable(id) {
    return getGraficos().then(graficos => {
        $("#list-graficos").htmlTemplate('graficos_list', {graficos: graficos, identificadorReport: id});
    });
}

$(function ($) {
    $.fn.reportTable = function (report) {
        let $this = this;
        db.exeRead("relatorios", parseInt(report)).then(report => {
            reportTable(!isEmpty(report) ? report[0] : null, $this);
        });
        return $this;
    };

    /**
     * Ação de clique no menu de relatórios, chama o relatório
     */
    $("#report-menu").off("click", ".report-menu").on("click", ".report-menu", function () {
        pageTransition($(this).attr("rel"), "report", "forward", "#report");
    });

    $("#app").off("click", ".btn-report-advanced").on("click", ".btn-report-advanced", function () {
        let $filter = $(".table-report");
        if ($filter.css("height") === "0px") {
            $filter.css("height", "auto");
            let h = $filter.css("height");
            $filter.css("height", 0);
            $filter.css("height", h);
            setTimeout(function () {
                $filter.css("height", "auto")
            }, 300);

        } else {
            $filter.css("height", $filter.css("height"));
            $filter.css("height", 0);
            $filter.find(".table-filter-operator, .table-filter-value, .table-filter-btn").addClass("hide");
            $filter.find(".table-filter-operator").val("");
            $filter.find(".table-filter-value").val("");
        }
    }).off("change", "#dataInicial").on("change", "#dataInicial", function () {
        let report = reports[$(this).data("rel")];
        report.dateStart = $(this).val();
        let colunaDate = findColumnDate(report.entity);

        if (isEmpty(report.report) || typeof report.report[0] !== "object") {
            report.report = [];
            report.report.push({
                columnName: "regras",
                columnRelation: "relatorios_regras",
                columnStatus: {column: "", have: false, value: false},
                columnTituloExtend: "<small class='color-gray left opacity padding-tiny radius'>tipo</small><span style='padding: 1px 5px' class='left padding-right font-medium td-title'> select</span>",
                grupos: [],
                id: Math.floor((Math.random() * 1000)) + "" + Date.now(),
                identificador: report.identificador,
                tipo: "select"
            });
            report.report[0].grupos.push({
                filtros: []
            });
        } else {
            for (let i in report.report[0].grupos[0].filtros) {
                if (report.report[0].grupos[0].filtros[i].id === "99999998765") {
                    report.report[0].grupos[0].filtros.splice(i, 1);
                    break;
                }
            }
        }

        if (report.dateStart !== "") {
            report.report[0].grupos[0].filtros.push({
                columnName: "filtros",
                columnRelation: "relatorios_filtro",
                columnStatus: {column: "", have: false, value: false},
                columnTituloExtend: "<small class='color-gray left opacity padding-tiny radius'>regra</small><span style='padding: 1px 5px' class='left padding-right font-medium td-title'> e => valor maior igual a " + report.dateStart + "</span>",
                coluna: colunaDate,
                colunas: '["' + colunaDate + '"]',
                entidades: '["' + report.entity + '"]',
                id: "99999998765",
                identificador: report.identificador,
                logica: "and",
                operador: "maior igual a",
                valor: report.dateStart
            });
        }

        if (colunaDate !== "")
            report.readData();
        else
            toast("campo de data não encontrado", "toast-warning");

    }).off("change", "#dataFinal").on("change", "#dataFinal", function () {
        let report = reports[$(this).data("rel")];
        report.dateEnd = $(this).val();

        let colunaDate = findColumnDate(report.entity);

        if (isEmpty(report.report) || typeof report.report[0] !== "object") {
            report.report = [];
            report.report.push({
                columnName: "regras",
                columnRelation: "relatorios_regras",
                columnStatus: {column: "", have: false, value: false},
                columnTituloExtend: "<small class='color-gray left opacity padding-tiny radius'>tipo</small><span style='padding: 1px 5px' class='left padding-right font-medium td-title'> select</span>",
                grupos: [],
                id: Math.floor((Math.random() * 1000)) + "" + Date.now(),
                identificador: report.identificador,
                tipo: "select"
            });
            report.report[0].grupos.push({
                filtros: []
            });
        } else {
            for (let i in report.report[0].grupos[0].filtros) {
                if (report.report[0].grupos[0].filtros[i].id === "99999998764") {
                    report.report[0].grupos[0].filtros.splice(i, 1);
                    break;
                }
            }
        }

        if (report.dateEnd !== "") {
            report.report[0].grupos[0].filtros.push({
                columnName: "filtros",
                columnRelation: "relatorios_filtro",
                columnStatus: {column: "", have: false, value: false},
                columnTituloExtend: "<small class='color-gray left opacity padding-tiny radius'>regra</small><span style='padding: 1px 5px' class='left padding-right font-medium td-title'> e => valor menor igual a " + report.dateEnd + "</span>",
                coluna: colunaDate,
                colunas: '["' + colunaDate + '"]',
                entidades: '["' + report.entity + '"]',
                id: "99999998764",
                identificador: report.identificador,
                logica: "and",
                operador: "menor igual a",
                valor: report.dateEnd
            });
        }

        if (colunaDate !== "")
            report.readData();
        else
            toast("campo de data não encontrado", "toast-warning");

    }).off("change", ".tableReportLimit").on("change", ".tableReportLimit", function () {
        let report = reports[$(this).attr("data-id")];
        localStorage.limitGrid = parseInt($(this).val());
        report.limit = parseInt(localStorage.limitGrid);
        report.readData();

    }).off("change", ".report-select-all").on("change", ".report-select-all", function () {
        let report = reports[$(this).attr("data-id")];
        report.$content.find(".report-select").prop("checked", $(this).is(":checked"));

        report.selecionados = [];
        $(".report-select:checked").each(function (i, e) {
            report.selecionados.push(parseInt($(e).attr("rel")));
        });
    }).off("click", ".report-select").on("click", ".report-select", function (evt) {
        let all = !0;
        let $this = $(this);
        let report = reports[$this.attr("data-id")];
        let action = $this.is(":checked");
        if ((evt.ctrlKey || evt.shiftKey) && report.$content.find(".report-select:checked").length > 1) {
            let first = report.$content.find(".report-select").index(report.$content.find(".report-select:checked").first());
            let last = report.$content.find(".report-select").index($this);
            if (action) {
                for (let i = first + 1; i < last; i++)
                    report.$content.find(".report-select:eq(" + i + ")").prop("checked", !0);
            } else {
                for (let i = last + 1; i < report.$content.find(".report-select").length; i++)
                    report.$content.find(".report-select:eq(" + i + ")").prop("checked", !1);
            }
        }
        $.each(report.$content.find(".report-select"), function () {
            if (all && $(this).is(":checked") !== $this.is(":checked"))
                all = !1
        });
        report.$element.find(".report-select-all").prop("checked", (all && $this.is(":checked")));

        report.selecionados = [];
        $(".report-select:checked").each(function (i, e) {
            report.selecionados.push(parseInt($(e).attr("rel")));
        });

    }).off("click", ".grid-order-by").on("click", ".grid-order-by", function () {
        let report = reports[$(this).attr("rel")];
        report.$element.find(".grid-order-by-arrow").remove();
        if (report.order === $(this).attr("data-column")) {
            report.orderPosition = !report.orderPosition
        } else {
            report.order = $(this).attr("data-column");
            report.orderPosition = !1
        }

        if (report.orderPosition)
            $(this).append("<i class='material-icons grid-order-by-arrow left padding-8'>arrow_drop_up</i>");
        else
            $(this).append("<i class='material-icons grid-order-by-arrow left padding-8'>arrow_drop_down</i>");

        report.readData();

    }).off("click", ".showHideField").on("click", ".showHideField", function () {
        let $this = $(this);
        let val = $this.val();
        let checked = $this.is(":checked");
        let identificador = $this.data("rel");
        let report = reports[identificador];
        let th = report.$element.find("thead").find("th[rel='" + val + "']");
        let td = report.$element.find("tbody").find("td[rel='" + val + "']");
        report.fields.find(s => s.column === val).show = checked;
        if (checked) {
            th.removeClass("hide");
            td.removeClass("hide")
        } else {
            th.addClass("hide");
            td.addClass("hide")
        }

        AJAX.post("saveFieldsGrid", {type: "report", entity: report.id, fields: report.fields});

    }).off("click", ".report-header-option").on("click", ".report-header-option", function () {
        let $this = $(this);
        let identificador = $this.data("rel");
        let report = reports[identificador];
        let tpl = getTemplates();
        $this.parent().append(Mustache.render(tpl.grid_content_card_header, {
            identificador: $this.data("rel"),
            entity: $this.data("entity"),
            columns: report.fields
        }));
        let $cardHeader = $(".grid_content_card_header");
        $(document).on("mouseup", function (e) {
            if (!$cardHeader.is(e.target) && $cardHeader.has(e.target).length === 0) {
                $cardHeader.remove();
                $(document).off("mouseup")
            }
        });

    }).off("click", "#enviar-mensagem").on("click", "#enviar-mensagem", function () {

        let colunaUsuario = null, options = [], report = [];
        for (let i in reports) {
            report = reports[i];
            break;
        }

        dbLocal.exeRead("__info", 1).then(info => {
            if (info[report.entity].user === 1) {
                colunaUsuario = ["usuarios_id", "usuarios"];
            } else {
                for (let col in dicionarios[report.entity]) {
                    let meta = dicionarios[report.entity][col];
                    if (meta.key === "relation" && meta.group === "one" && meta.type === "int" && !isEmpty(meta.relation) && typeof info[meta.relation] !== "undefined" && info[meta.relation].user === 1)
                        options.push({coluna: col, nome: meta.nome, relation: meta.relation});
                }

                if (options.length === 1)
                    colunaUsuario = [options[0].coluna, options[0].relation];
            }

            if (colunaUsuario) {
                goMessage(colunaUsuario, report.id, report.selecionados);

            } else if (options.length > 1) {
                let $dialog = $("<div id='dialog_coluna'><h5>Enviar mensagem para:</h5><select id='select_coluna'></select><button class='btn theme right padding-large' id='button_coluna'>Enviar</button> </div>").appendTo(".report-main");
                let $select = $dialog.find("#select_coluna");
                for (let i in options)
                    $select.append("<option value=\"['" + options[i].coluna + "','" + options[i].relation + "']\">" + options[i].nome + "</option>");

                $("#core-overlay").addClass("active").off("click").on("click", function () {
                    $(this).removeClass("active");
                    $dialog.remove();
                });

                $("#button_coluna").one("click", function () {
                    if ($select.val()) {
                        $(this).removeClass("active");
                        $dialog.remove();
                        goMessage(JSON.parse($select.val()), report.id, report.selecionados);
                    } else {
                        toast("selecione o usuário", 1500, "toast-warning");
                    }
                });
            } else {
                toast("Não existe usuários neste relatório.", 3500, "toast-warning")
            }
        });

    }).off("click", "#gerar-grafico").on("click", "#gerar-grafico", function () {
        let id = $(this).attr("rel");
        let report = reports[id];
        report.$element.find(".modal-grafico").removeClass("hide");
        let contentY = "";
        let contentX = "";
        for (let column in dicionarios[report.entity]) {
            let meta = dicionarios[report.entity][column];
            if (meta.key !== "publisher" && meta.key !== "information" && meta.key !== "identifier") {
                contentY += "<option value='" + column + "'>" + meta.nome + "</option>";
                contentX += "<option value='" + column + "'" + (meta.format === "datetime" || meta.format === "date" ? " selected='selected'" : "") + ">" + meta.nome + "</option>"
            }
        }
        readGraficosTable(id);

        $("#core-overlay").addClass("active activeBold");
        $(".table-grafico-columns-y").attr("data-id", id).html("<option value='' selected='selected'>Nenhum</option>" + contentY);
        $(".table-grafico-columns-x").html("<option disabled='disabled' value='' selected='selected'>Selecione o X</option>" + contentX);

    }).off("click", ".btn-table-grafico-apply").on("click", ".btn-table-grafico-apply", function () {
        let identificador = $(this).attr("rel");
        let report = reports[identificador];

        let y = $(".table-grafico-columns-y").val();
        let x = $(".table-grafico-columns-x").val();
        let type = $(".table-grafico-columns-type").val();
        let operacao = $(".table-grafico-columns-operacao").val();
        let group = $(".table-grafico-columns-group").val();
        let order = $(".table-grafico-columns-order").val();
        let precision = $(".table-grafico-columns-precision").val();
        let size = $(".table-grafico-columns-size").val();
        let posicao = $(".table-grafico-columns-posicao").val();
        let labely = $(".table-grafico-columns-label-y").val();
        let labelx = $(".table-grafico-columns-label-x").val();
        let rounded = $(".table-grafico-columns-rounded").val();
        let minimoY = $(".table-grafico-columns-minimo-y").val();
        let maximoY = $(".table-grafico-columns-maximo-y").val();
        let minimoX = $(".table-grafico-columns-minimo-x").val();
        let maximoX = $(".table-grafico-columns-maximo-x").val();
        let id = $(".table-grafico-columns-y").attr("data-id");

        $(".table-grafico-columns").css("border-bottom-color", "#009688").siblings("div").addClass("color-text-gray").css("color", "initial");
        $(".required-grafico").remove();

        switch (type) {
            case "donut":
                if (typeof x !== "string" || isEmpty(x)) {
                    toast("informe o X", 3000, "toast-warning");
                    $(".table-grafico-columns-x").css("border-bottom-color", "red").siblings("div").removeClass("color-text-gray").css("color", "red").append("<div class='required-grafico padding-small' style='display: inline'>*</div>");
                    return
                }
                if (typeof y !== "string" || isEmpty(y)) {
                    toast("informe o Y", 3000, "toast-warning");
                    $(".table-grafico-columns-y").css("border-bottom-color", "red").siblings("div").removeClass("color-text-gray").css("color", "red").append("<div class='required-grafico padding-small' style='display: inline'>*</div>");
                    return
                }
                break
        }

        if (type === "radialBar" && (isEmpty(maximo) || isNaN(maximo))) {
            toast("Valor máximo é obrigatório para o Modelo barra Circular", 5000, "toast-warning");
            $(".table-grafico-columns-maximo").css("border-bottom-color", "red").siblings("div").removeClass("color-text-gray").css("color", "red").append("<div class='required-grafico padding-small' style='display: inline'>*</div>");
            return
        }
        if (isEmpty(x) && ["radialBar"].indexOf(type) === -1) {
            toast("informe o X", 3000, "toast-warning");
            $(".table-grafico-columns-x").css("border-bottom-color", "red").siblings("div").removeClass("color-text-gray").css("color", "red").append("<div class='required-grafico padding-small' style='display: inline'>*</div>");
            return
        }

        AJAX.post("create/grafico", {
            x: x,
            y: y,
            entity: reports[id].entity,
            type: type,
            group: group,
            order: order,
            precision: precision,
            operacao: operacao,
            size: size,
            posicao: posicao,
            minimoY: minimoY,
            maximoY: maximoY,
            minimoX: minimoX,
            maximoX: maximoX,
            labely: labely,
            labelx: labelx,
            rounded: rounded,
            report: report.id
        }).then(g => {
            if (g) {
                updateGraficos().then(() => {
                    readGraficosTable(identificador)
                });
                toast("Salvo com sucesso", 3500, "toast-success")
            } else {
                toast("erro ao enviar", 3000, "toast-error")
            }
        })
    }).off("click", ".btn-grafico-delete").on("click", ".btn-grafico-delete", function () {
        let identificador = $(this).attr("rel");
        let id = $(this).attr("data-id");
        if(confirm("excluir gráfico?")) {
            AJAX.post("delete/grafico", {id: id}).then(() => {
                updateGraficos().then(() => {
                    readGraficosTable(identificador)
                })
            })
        }
    }).off("change", ".table-grafico-columns-type").on("change", ".table-grafico-columns-type", function () {
        let v = $(this).val();
        $(".table-grafico-columns").removeClass("disabled").removeAttr("disabled");
        if (v === "radialBar") {
            $(".table-grafico-columns-x").addClass("disabled").attr("disabled", "disabled").val("").trigger("change");
            $(".table-grafico-columns-label-x").addClass("disabled").attr("disabled", "disabled").val("").trigger("change")
        }
    }).off("click", ".btn-close-modal").on("click", ".btn-close-modal", function () {
        let report = reports[$(this).attr("rel")];
        report.$element.find(".modal-filter, .modal-grafico").addClass("hide");
        $("#core-overlay").removeClass("active activeBold");
    })
}, jQuery);