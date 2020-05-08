<?php

$data['data'] = [];
if(file_exists(PATH_HOME . "_cdn/fieldsCustom/" . $_SESSION['userlogin']['id'] . ".json"))
    $data['data'] = json_decode(file_get_contents(PATH_HOME . "_cdn/fieldsCustom/" . $_SESSION['userlogin']['id'] . ".json"), !0);