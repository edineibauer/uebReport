<?php

$type = $link->getVariaveis()[0];
$entity = $link->getVariaveis()[1];

$data['data'] = [];
if(file_exists(PATH_HOME . "_cdn/fieldsCustom/{$entity}/{$type}/" . $_SESSION['userlogin']['id'] . ".json"))
    $data['data'] = json_decode(file_get_contents(PATH_HOME . "_cdn/fieldsCustom/{$entity}/{$type}" . $_SESSION['userlogin']['id'] . ".json"), !0);