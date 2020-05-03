/**
 * Faz request para ler report
 * @param entity
 * @param filter
 * @param order
 * @param reverse
 * @param limit
 * @param offset
 * @returns {PromiseLike<any> | Promise<any>}
 */
async function reportRead(entity, filter, order, reverse, limit, offset) {
    order = typeof order === "string" ? order : "id";
    reverse = (typeof reverse !== "undefined" ? (reverse ? !0 : !1) : !1);
    limit = parseInt(typeof limit === "number" ? limit : (localStorage.limitGrid ? localStorage.limitGrid : 15));
    limit = limit < parseInt(localStorage.limitGrid) ? parseInt(localStorage.limitGrid) : limit;
    offset = parseInt((typeof offset === "number" ? offset : 0) - 1);

    /**
     * Se tiver mais resultados no back que não estão no front
     * Ou se tiver filtros a serem aplicados
     * Ou se não estiver trabalhando com uma base front
     * então faz a leitura online
     */
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: HOME + 'set',
            data: {
                lib: "report",
                file: "read/report",
                entity: entity,
                filter: filter,
                order: order,
                reverse: reverse,
                limit: limit,
                offset: offset
            },
            success: function (dados) {
                if (dados.response === 1)
                    resolve({data: dados.data.data, length: dados.data.total});
            },
            error: () => resolve(readOffline(data, filter, order, reverse, limit, offset)),
            dataType: "json"
        })
    })
}