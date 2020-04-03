var reports = [];


function reportTr(identificador, entity, data, fields) {
    let gridContent = {
        id: data.id || 0,
        online: navigator.onLine,
        identificador: identificador,
        entity: entity,
        fields: []
    };

    let wait = [];
    $.each(fields, function (i, e) {
        if (typeof data[e.column] !== "undefined") {
            let tr = {
                id: data.id,
                entity: gridContent.entity,
                style: '',
                class: '',
                checked: !1,
                first: e.first
            };
            tr.class = getTrClass(dicionarios[entity][e.column], data[e.column]);
            tr.style = getTrStyle(dicionarios[entity][e.column], data[e.column]);
            gridContent.fields.push(tr);

            wait.push(gridTdFilterValue(data[e.column], dicionarios[entity][e.column]).then(v => {
                tr.value = v
            }))
        }
    });

    return Promise.all(wait).then(() => {
        return gridContent
    })
}

function reportTable(dataReport, $element) {

    let identificador = Math.floor((Math.random() * 1000)) + "" + Date.now();

    let filtros = [];
    if (!isEmpty(dataReport.filtros)) {
        for (let i in dataReport.filtros)
            filtros.push({
                column: dataReport.filtros[i].coluna,
                operator: dataReport.filtros[i].operador,
                value: dataReport.filtros[i].valor
            });
    }

    reports = [];
    let report = reports[identificador] = {
        identificador: identificador,
        id: dataReport.id,
        nome: dataReport.nome,
        entity: dataReport.entidade,
        data: {},
        $element: $element,
        $content: "",
        total: 0,
        page: 1,
        selecionados: [],
        order: dataReport.ordem,
        orderPosition: dataReport.decrescente,
        filter: filtros,
        historic: 0,
        loadingTime: null,
        loadingHtml: null,
        fields: [],

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

        readData: function () {
            clearHeaderScrollPosition();
            let $this = this;
            $this.$content = $this.$element.find("tbody");
            $(".table-info-result").remove();
            $this.$content.parent().find("thead").removeClass("hide");

            this.setLoading();

            let result = exeRead($this.entity, $this.filter, $this.order, $this.orderPosition, 1000, -1);
            let templates = getTemplates();
            return Promise.all([result, templates]).then(r => {
                result = r[0];
                templates = r[1];

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
                })
            })
        },

        getShow: function () {
            var fields = (isEmpty(report.fields) ? getFields(report.entity, !0) : Promise.all([]));
            return Promise.all([fields]).then(r => {
                if (isEmpty(report.fields))
                    this.fields = r[0];

                return getTemplates().then(templates => {
                    return Mustache.render(templates.report_table, {
                        entity: report.entity,
                        title: report.nome,
                        home: HOME,
                        identificador: this.identificador,
                        total: 0,
                        fields: this.fields
                    })
                });
            })
        },

        show: function () {
            return this.getShow().then(reportData => {
                pageTransition(reportData, "", "forward", this.$element.attr("id"));
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

$(function ($) {
    $.fn.reportTable = function (report) {
        let $this = this;
        dbLocal.exeRead("relatorios", parseInt(report)).then(report => {
            reportTable(report, $this);
        });
        return $this;
    };

    /**
     * Menu de relatórios
     */
    dbLocal.exeRead("relatorios").then(reports => {
        let $menu = $("#report-menu").html("<ul>");
        for (let i in reports) {
            $menu.append("<li rel='" + reports[i].id + "' class='report-menu col container padding-8 theme-hover pointer' style='border-bottom-right-radius: 5px;border-top-right-radius: 5px;'>" + reports[i].nome + "</li>");
        }
        $menu.append("</ul>");
    });

    /**
     * Ação de clique no menu de relatórios, chama o relatório
     */
    $("#report-menu").off("click", ".report-menu").on("click", ".report-menu", function () {
        pageTransition($(this).attr("rel"), "report", "forward", "#report");
    });

    $("#app").off("change", ".report-select-all").on("change", ".report-select-all", function () {
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

        report.readData()
    }).off("click", "#enviar-mensagem").on("click", "#enviar-mensagem", function () {
        pageTransition("enviar_mensagem", "form", "forward", "#report").then(() => {
            for(let i in reports) {
                form.data.relatorio = reports[i].id;
                form.data.selecionados = reports[i].selecionados;
                break;
            }
        })
    });
}, jQuery);