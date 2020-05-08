<?php

$fields = filter_input(INPUT_POST, 'fields', FILTER_DEFAULT, FILTER_REQUIRE_ARRAY);
\Helpers\Helper::createFolderIfNoExist(PATH_HOME . "_cdn/fieldsCustom");

$f = fopen(PATH_HOME . "_cdn/fieldsCustom/" . $_SESSION['userlogin']['id'] . ".json", "w+");
fwrite($f, json_encode($fields));
fclose($f);