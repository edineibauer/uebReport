<?php


/**
 * @param string $filter
 * @param array $dicionario
 * @return string
 */
function exeReadApplyFilter(string $filter, array $dicionario)
{
    $result = "";
    if (!empty($filter) && \Helpers\Check::isJson($filter)) {
        $filter = json_decode($filter, !0);
        $where = [];

        foreach ($filter as $i => $filterOption) {
            if ($filterOption['operador'] === "por") {
                foreach ($dicionario as $meta) {
                    if (!in_array($meta['key'], ["information", "identifier"]))
                        $where[$i][] = $meta['coluna'] . " LIKE '%{$filterOption['valor']}%'";
                }

            } else {
                switch ($filterOption['operador']) {
                    case 'contém':
                        $where[$i][] = "{$filterOption['coluna']} LIKE '%{$filterOption['valor']}%'";
                        break;
                    case 'igual a':
                        $where[$i][] = "{$filterOption['coluna']} = '{$filterOption['valor']}'";
                        break;
                    case 'diferente de':
                        $where[$i][] = "{$filterOption['coluna']} != '{$filterOption['valor']}'";
                        break;
                    case 'começa com':
                        $where[$i][] = "{$filterOption['coluna']} LIKE '{$filterOption['valor']}%'";
                        break;
                    case 'termina com':
                        $where[$i][] = "{$filterOption['coluna']} LIKE '%{$filterOption['valor']}'";
                        break;
                    case 'maior que':
                        $where[$i][] = "{$filterOption['coluna']} > {$filterOption['valor']}";
                        break;
                    case 'menor que':
                        $where[$i][] = "{$filterOption['coluna']} < {$filterOption['valor']}";
                        break;
                    case 'maior igual a':
                        $where[$i][] = "{$filterOption['coluna']} >= {$filterOption['valor']}";
                        break;
                    case 'menor igual a':
                        $where[$i][] = "{$filterOption['coluna']} <= {$filterOption['valor']}";
                }
            }
        }

        /**
         * Monta sentença Query com o array de filtros optidos
         */
        foreach ($where as $andContainer) {
            $result .= " && (";
            foreach ($andContainer as $e => $or)
                $result .= ($e > 0 ? " || " : "") . $or;

            $result .= ")";
        }
    }

    return $result;
}

$usuarios = [];
$emails = [];

$mensagem = $dados;
$mensagem['imagem'] = (!empty($mensagem['imagem']) ? json_decode($mensagem['imagem'], !0)[0]['url'] : "");
$mensagem['canais'] = json_decode($mensagem['canais'], !0);

if (!empty($mensagem['enviar_para_relatorios'])) {
    $relatorios = json_decode($mensagem['enviar_para_relatorios'], !0);

    $read = new \Conn\Read();
    foreach ($relatorios as $relatorio) {
        $read->exeRead("relatorios", "WHERE id = :rid", "rid={$relatorio}");
        if ($read->getResult()) {
            $report = $read->getResult()[0];
            $dicionario = \Entity\Metadados::getDicionario($report['entidade']);
            $isReportCliente = $report['entidade'] === $mensagem['enviar_para'];

            /**
             * Encontra a coluna
             */
            $column = "";
            if ($isReportCliente) {
                $column = "usuarios_id";
            } else {
                foreach ($dicionario as $item) {
                    if ($item['relation'] === $mensagem['enviar_para']) {
                        $column = $item['column'];
                        break;
                    }
                }
            }

            if (!empty($column)) {

                /**
                 * Encontra email
                 */
                $email = "";
                if (in_array("2", $mensagem['canais'])) {
                    if ($isReportCliente) {
                        $dicionarioCliente = $dicionario;
                    } else {
                        $dicionarioCliente = \Entity\Metadados::getDicionario($mensagem['enviar_para']);
                    }

                    foreach ($dicionarioCliente as $dic) {
                        if ($dic['format'] === "email") {
                            $email = $dic['column'];
                            break;
                        }
                    }
                }

                /**
                 * Monta Where
                 */
                $where = exeReadApplyFilter($report['filtros'], $dicionario);
                $where .= " ORDER BY " . (!empty($report['ordem']) ? "e." . $report['ordem'] : "e.id") . ($report['decrescente'] === null || $report['decrescente'] ? " DESC" : " ASC");

                $sql = new \Conn\SqlCommand();

                if ($isReportCliente)
                    $sql->exeCommand("SELECT e.usuarios_id" . (!empty($email) ? ", e.{$email} as email" : "") . " FROM " . PRE . $report['entidade'] . " as e WHERE id > 0" . $where);
                else
                    $sql->exeCommand("SELECT c.usuarios_id" . (!empty($email) ? ", c.{$email} as email" : "") . " FROM " . PRE . $report['entidade'] . " as e INNER JOIN " . PRE . $mensagem['enviar_para'] . " as c ON e.{$column} = c.id WHERE e.id > 0" . $where);

                if ($sql->getResult()) {
                    foreach ($sql->getResult() as $result) {
                        if (!in_array($result['usuarios_id'], $usuarios)) {
                            $usuarios[] = $result['usuarios_id'];
                            if (!empty($result['email']))
                                $emails[$result['usuarios_id']] = $result['email'];
                        }
                    }
                }
            }
        }
    }

    /**
     * Atualiza total de mensagens enviada em Enviar Mensagem
     */
    $up = new \Conn\Update();
    $up->exeUpdate("enviar_mensagem", ["total_de_envios" => count($usuarios)], "WHERE id = :mid", "mid={$dados['id']}");

    if (!empty($usuarios)) {

        /**
         * push notification
         */
        if (in_array("1", $mensagem['canais'])) {

            /**
             * Para cada usuário, envia a mensagem
             */
            $note = new \Dashboard\Notification();
            $note->setTitulo($mensagem['assunto']);
            $note->setDescricao($mensagem['descricao']);
            $note->setImagem($mensagem['imagem']);

            if (!empty($mensagem['url']))
                $note->setUrl($mensagem['url']);

            $note->setUsuarios($usuarios);
            $note->enviar();
        }

        /**
         * Email notification
         */
        if (in_array("2", $mensagem['canais'])) {
            foreach ($usuarios as $usuario) {
                if (!empty($emails[$usuario])) {
                    $emailSend = new \Email\Email();
                    $emailSend->setAssunto($mensagem['assunto']);
                    $emailSend->setMensagem($mensagem['descricao']);
                    $emailSend->setDestinatarioEmail($emails[$usuario]);
                    $emailSend->enviar();
                }
            }
        }
    }
}