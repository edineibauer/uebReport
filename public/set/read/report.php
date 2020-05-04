<?php

use \Config\Config;

$filter['regras'] = json_encode(filter_input(INPUT_POST, 'filter', FILTER_DEFAULT, FILTER_REQUIRE_ARRAY));
$filter['entidade'] = filter_input(INPUT_POST, 'entity', FILTER_DEFAULT);
$filter['ordem'] = filter_input(INPUT_POST, 'order', FILTER_DEFAULT);
$filter['decrescente'] = filter_input(INPUT_POST, 'reverse', FILTER_VALIDATE_BOOLEAN);
$filter['agrupamento'] = filter_input(INPUT_POST, 'aggroup', FILTER_DEFAULT);
$filter['soma'] = filter_input(INPUT_POST, 'soma', FILTER_DEFAULT);
$filter['media'] = filter_input(INPUT_POST, 'media', FILTER_DEFAULT);

$limit = filter_input(INPUT_POST, 'limit', FILTER_VALIDATE_INT);
$limit = empty($limit) ? LIMITOFFLINE : $limit;
$offset = filter_input(INPUT_POST, 'offset', FILTER_VALIDATE_INT);

$setor = !empty($_SESSION['userlogin']) ? $_SESSION['userlogin']['setor'] : "0";
$permissoes = Config::getPermission();

/**
 * Estou logado, não sou ADM, não tenho permissão de leitura, mas a entidade é o meu tipo de usuário
 */
$entityIsMySetor = ($setor !== "admin" && (isset($permissoes[$setor][$entity]['read']) && !$permissoes[$setor][$entity]['read']) && $setor !== "0" && $entity === $setor);

if ($setor === "admin" || (isset($permissoes[$setor][$entity]['read']) || $permissoes[$setor][$entity]['read']) || $entityIsMySetor) {
    $report = new \Report\Report($filter, $limit, $offset);
    $data['data'] = ['data' => $report->getResult(), 'total' => $report->getTotal()];
}