<?php

$read = new \Conn\Read();
$read->exeRead("enviar_mensagem", "WHERE data_de_envio <= NOW() && status_de_envio = 0");
if($read->getResult()) {
    $mensagem = $read->getResult()[0];
    $mensagem['canais'] = json_decode($mensagem['canais'], !0);
    $mensagem['imagem'] = (!empty($mensagem['imagem']) ? json_decode($mensagem['imagem'], !0)[0]['url'] : "");
    $mensagem['selecionados'] = (empty($mensagem['selecionados']) ? null : json_decode($mensagem['selecionados'], !0));

    /**
     * Busca os dados do relatório
     */
    $read->exeRead("relatorios", "WHERE id=:rid", "rid={$mensagem['relatorio']}");
    if($read->getResult()) {
        $reports = $read->getResult()[0];
        $data = \Entity\Entity::loadData($reports['entidade'], (!empty($reports['filtros']) ? json_decode($reports['filtros'], !0) : null), $reports['ordem'], $reports['decrescente']);

        /**
         * Para cada resultado na leitura dos registros do relatório
         */
        foreach ($data['data'] as $result) {
            if(empty($mensagem['selecionados']) || in_array($result['id'], $mensagem['selecionados'])) {
                /**
                 * Somente registros selecionados, ou todos caso não tenha seleção
                 */

                /**
                 * Obtém usuário para enviar a mensagem
                 */
                $user = 1;


                /**
                 * push notification
                 */
                if(in_array(1, $mensagem['canais'])) {
                    $note = new \Dashboard\Notification();
                    $note->setTitulo($mensagem['titulo']);
                    $note->setDescricao($mensagem['descricao']);
                    $note->setImagem($mensagem['imagem']);
                    $note->setUrl($mensagem['url']);
                    $note->setUsuario($user);
                    $note->enviar();
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