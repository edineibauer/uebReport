<?php

$read = new \Conn\Read();
$read->exeRead("enviar_mensagem", "WHERE data_de_envio <= NOW() && status_de_envio = 0");
if ($read->getResult()) {
    $mensagem = $read->getResult()[0];
    $mensagem['canais'] = json_decode($mensagem['canais'], !0);
    $mensagem['imagem'] = (!empty($mensagem['imagem']) ? json_decode($mensagem['imagem'], !0)[0]['url'] : "");
    $mensagem['selecionados'] = (empty($mensagem['selecionados']) ? null : json_decode($mensagem['selecionados'], !0));

    /**
     * Busca os dados do relatório
     */
    $read->exeRead("relatorios", "WHERE id=:rid", "rid={$mensagem['relatorio']}");
    if ($read->getResult()) {
        $reports = $read->getResult()[0];
        $data = \Entity\Entity::loadData($reports['entidade'], (!empty($reports['filtros']) ? json_decode($reports['filtros'], !0) : null), $reports['ordem'], $reports['decrescente']);

        /**
         * Para cada resultado na leitura dos registros do relatório
         */
        foreach ($data['data'] as $result) {

            /**
             * Somente registros selecionados, ou todos caso não tenha seleção
             */
            if (empty($mensagem['selecionados']) || in_array($result['id'], $mensagem['selecionados'])) {

                $user = 0;
                $email = "";
                if ($mensagem['entidade_do_usuario'] === "usuarios") {
                    $user = (int)$result[$mensagem['coluna_do_usuario']];
                    $email = (!empty($result['email']) ? $result['email'] : "");
                } else {
                    $read->exeRead($mensagem['entidade_do_usuario'], "WHERE id = :idu", "idu={$result[$mensagem['coluna_do_usuario']]}");
                    if ($read->getResult()) {
                        $user = (int)$read->getResult()[0]['usuarios_id'];
                        $email = (!empty($read->getResult()[0]['email']) ? $read->getResult()[0]['email'] : "");
                    }
                }

                /**
                 * Se existe o usuário para enviar a mensagem
                 */
                if ($user > 0) {

                    /**
                     * push notification
                     */
                    if (in_array("1", $mensagem['canais'])) {
                        $note = new \Dashboard\Notification();
                        $note->setTitulo($mensagem['titulo']);
                        $note->setDescricao($mensagem['descricao']);
                        $note->setImagem($mensagem['imagem']);

                        if(!empty($mensagem['url']))
                            $note->setUrl($mensagem['url']);

                        $note->setUsuario($user);
                        $note->enviar();
                    }

                    /**
                     * SMS notification
                     */
                    if (in_array("2", $mensagem['canais'])) {

                    }

                    /**
                     * Email notification
                     */
                    if (in_array("3", $mensagem['canais']) && !empty($email)) {

                        $emailSend = new \Email\Email();
                        $emailSend->setAssunto($mensagem['titulo']);
                        $emailSend->setMensagem($mensagem['descricao']);
//                        $emailSend->setAnexo($mensagem['imagemjson']);
                        $emailSend->setDestinatarioEmail($email);
                        $emailSend->enviar();
                    }
                }
            }
        }
    }

    /**
     * Atualiza o status de envio para enviado
     */
    $up = new \Conn\Update();
    $up->exeUpdate("enviar_mensagem", ['status_de_envio' => 1], "WHERE id = :idm", "idm={$mensagem['id']}");
}