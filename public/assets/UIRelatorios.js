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

function gridTdFilterValue(value, meta) {
    if (typeof meta !== "undefined") {
        if (['select', 'radio'].indexOf(meta.format) > -1) {
            value = meta.allow.options.find(option => option.valor == value).representacao;
        } else if ('checkbox' === meta.format) {
            let resposta = "";
            for (let i in meta.allow.options)
                resposta += (value.indexOf(meta.allow.options[i].valor.toString()) > -1 ? ((resposta !== "" ? ", " : "") + meta.allow.options[i].representacao) : "");

            value = resposta;
        } else if (meta.format === "boolean") {
            value = "<div class='activeBoolean" + (value == 1 ? " active" : "") + "'></div>";
        } else if (['folder', 'extend'].indexOf(meta.format) > -1) {
            return getRelevantTitle(meta.relation, value, 1, !1)
        } else if (['list', 'selecao', 'checkbox_rel', 'checkbox_mult'].indexOf(meta.format) > -1) {
            return db.exeRead(meta.relation, parseInt(value)).then(data => {
                return getRelevantTitle(meta.relation, data, 1, !1)
            })
        } else {
            value = applyFilterToTd(value, meta)
        }
    }
    return Promise.all([]).then(() => {
        return value
    })
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
        limit: (localStorage.limitGrid ? parseInt(localStorage.limitGrid) : 15),
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

            let offset = ($this.page * $this.limit) - $this.limit;
            let result = exeRead($this.entity, $this.filter, $this.order, $this.orderPosition, $this.limit, offset);
            return Promise.all([result, getTemplates()]).then(r => {
                result = r[0];
                let templates = r[1];
                console.log(result);

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
            })
        },

        getShow: function () {
            var fields = (isEmpty(report.fields) ? getFields(report.entity, !0) : Promise.all([]));
            return Promise.all([fields]).then(r => {
                if (isEmpty(report.fields))
                    this.fields = r[0];

                console.log(this.limit);

                return getTemplates().then(templates => {
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

function goMessage(colunaUsuario, id, selecionados) {
    pageTransition("enviar_mensagem", "form", "forward", "#report").then(() => {
        form.data.relatorio = id;
        form.data.selecionados = selecionados;
        form.data.coluna_do_usuario = colunaUsuario[0];
        form.data.entidade_do_usuario = colunaUsuario[1];
    });
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

        report.readData()
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
    });
}, jQuery);
(function ($, window, document) {
    var MaterializePagination = function (elem, options) {
        this.$elem = $(elem);
        this.options = options;
        this.currentPage = null;
        this.visiblePages = []
    };
    MaterializePagination.prototype = {
        defaults: {
            align: 'left',
            lastPage: 1,
            firstPage: 1,
            maxVisiblePages: 3,
            urlParameter: 'page',
            useUrlParameter: !1,
            onClickCallback: function () {
            }
        }, init: function () {
            this.config = $.extend({}, this.defaults, this.options);
            if (this.createPaginationBase(this.config.currentPage))
                this.bindClickEvent()
        }, createPaginationBase: function (requestedPage) {
            if (isNaN(this.config.firstPage) || isNaN(this.config.lastPage)) {
                console.error('Both firstPage and lastPage attributes need to be integer values');
                return !1
            } else if (this.config.firstPage > this.config.lastPage) {
                console.error('Value of firstPage must be less than the value of lastPage');
                return !1
            }
            this.config.firstPage = parseInt(this.config.firstPage);
            this.config.lastPage = parseInt(this.config.lastPage);
            this.currentPage = this.config.firstPage - this.config.maxVisiblePages;
            this.$container = $('<ul class="bar" style="-webkit-touch-callout: none;-webkit-user-select: none;-khtml-user-select: none;-moz-user-select: none; -ms-user-select: none; user-select: none;">').addClass('pagination padding-16').addClass(this.config.align + '-align');
            this.$prevEllipsis = this.util.Ellipsis();
            this.$nextEllipsis = this.util.Ellipsis();
            var $firstPage = this.util.createPage(this.config.firstPage);
            var $prevChevron = this.util.createChevron('prev');
            var $nextChevron = this.util.createChevron('next');
            this.$container.append($prevChevron).append($firstPage).append(this.$prevEllipsis.$elem).append(this.$nextEllipsis.$elem).append($nextChevron);
            if (this.config.lastPage > this.config.firstPage) {
                var $lastPage = this.util.createPage(this.config.lastPage);
                $lastPage.insertBefore($nextChevron)
            }
            this.requestPage(requestedPage, !0);
            this.renderActivePage();
            this.$elem.append(this.$container);
            return !0
        }, requestPage: function (requestedPage, initing) {
            if (requestedPage !== this.currentPage) {
                this.requestPageByNumber(requestedPage)
            }
            if (!initing)
                this.config.onClickCallback(this.currentPage);
            this.renderActivePage();
            if (this.config.useUrlParameter)
                this.updateUrlParam(this.config.urlParameter, this.currentPage)
        }, requestPageByNumber: function (requestedPage) {
            this.purgeVisiblePages();
            this.currentPage = requestedPage;
            for (var i = this.currentPage - this.config.maxVisiblePages; i < this.currentPage + this.config.maxVisiblePages + 1; i++) {
                this.visiblePages.push(this.insertNextPaginationComponent(i))
            }
        }, renderActivePage: function () {
            this.renderEllipsis();
            this.$container.find('li.active').removeClass('active');
            var currentPageComponent = $(this.$container.find('[data-page="' + this.currentPage + '"]')[0]);
            currentPageComponent.addClass('active z-depth-2')
        }, renderEllipsis: function () {
            if (this.$prevEllipsis.isHidden && this.currentPage > this.config.firstPage + this.config.maxVisiblePages + 1)
                this.$prevEllipsis.show(); else if (!this.$prevEllipsis.isHidden && this.currentPage < this.config.firstPage + this.config.maxVisiblePages + 2)
                this.$prevEllipsis.hide();
            if (this.$nextEllipsis.isHidden && this.currentPage < this.config.lastPage - this.config.maxVisiblePages - 1)
                this.$nextEllipsis.show(); else if (!this.$nextEllipsis.isHidden && this.currentPage > this.config.lastPage - this.config.maxVisiblePages - 2)
                this.$nextEllipsis.hide()
        }, bindClickEvent: function () {
            var self = this;
            this.$container.on('click', 'li', function () {
                if ($(this).data('page') !== undefined) {
                    var requestedPage = self.sanitizePageRequest($(this).data('page'));
                    self.requestPage(requestedPage)
                }
            })
        }, insertNextPaginationComponent: function (pageNumber) {
            if (pageNumber > this.config.firstPage && pageNumber < this.config.lastPage) {
                var $paginationComponent = this.util.createPage(pageNumber);
                return $paginationComponent.insertBefore(this.$nextEllipsis.$elem)
            }
            return $('')
        }, sanitizePageRequest: function (pageData) {
            var requestedPage = this.config.firstPage;
            if (pageData === 'prev') {
                requestedPage = this.currentPage === this.config.firstPage ? this.currentPage : this.currentPage - 1
            } else if (pageData === 'next') {
                requestedPage = this.currentPage === this.config.lastPage ? this.currentPage : this.currentPage + 1
            } else if (!isNaN(pageData) && pageData >= this.config.firstPage && pageData <= this.config.lastPage) {
                requestedPage = parseInt(pageData)
            } else {
                requestedPage = null
            }
            return requestedPage
        }, purgeVisiblePages: function () {
            var size = this.visiblePages.length;
            for (var page = 0; page < size; page += 1)
                this.visiblePages.pop().remove();
        }, parseUrl: function () {
            var requestedPage = this.getUrlParamByName(this.config.urlParameter) || this.config.firstPage;
            return this.sanitizePageRequest(requestedPage)
        }, getUrlParamByName: function (name) {
            name = name.replace(/[\[\]]/g, "\\$&");
            var url = window.location.href;
            var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
            var results = regex.exec(url);
            if (!results) return null;
            if (!results[2]) return '';
            return decodeURIComponent(results[2].replace(/\+/g, " "))
        }, updateUrlParam: function (key, value) {
            var baseUrl = [location.protocol, '//', location.host, location.pathname].join(''),
                urlQueryString = document.location.search, newParam = key + '=' + value, params = '?' + newParam;
            if (urlQueryString) {
                keyRegex = new RegExp('([\?&])' + key + '[^&]*');
                if (urlQueryString.match(keyRegex) !== null) {
                    params = urlQueryString.replace(keyRegex, "$1" + newParam)
                } else {
                    params = urlQueryString + '&' + newParam
                }
            }
            window.history.pushState('', '', params)
        }, util: {
            createPage: function (pageData) {
                return $('<li>').html('<span>' + pageData + '</span>').addClass('hover-opacity-off opacity button').attr('data-page', pageData)
            }, createChevron: function (type) {
                var direction = type === 'next' ? 'right' : 'left';
                var $icon = $('<i>').addClass('hover-opacity-off opacity material-icons pointer').text('chevron_' + direction);
                return this.createPage(type).text('').attr('data-page', type).append($icon)
            }, Ellipsis: function () {
                var $ellipsis = $('<li>');
                $ellipsis.text('...');
                $ellipsis.addClass('hide button');
                return {
                    $elem: $ellipsis, isHidden: !0, show: function () {
                        this.isHidden = !1;
                        this.$elem.removeClass('hide')
                    }, hide: function () {
                        this.isHidden = !0;
                        this.$elem.addClass('hide')
                    }
                }
            }
        }
    };
    MaterializePagination.defaults = MaterializePagination.prototype.defaults;
    $.fn.materializePagination = function (options) {
        return this.each(function () {
            new MaterializePagination(this, options).init()
        })
    }
})(jQuery, window, document)