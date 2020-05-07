<?php

$id = filter_input(INPUT_POST, 'id', FILTER_DEFAULT);

if(file_exists(PATH_HOME . "_config/graficos.json")) {
    $graficos = json_decode(file_get_contents(PATH_HOME . "_config/graficos.json"), !0);

    $novoGrafico = [];
    foreach ($graficos as $grafico) {
        if($grafico['id'] != $id)
            $novoGrafico[] = $grafico;
    }

    $f = fopen(PATH_HOME . "_config/graficos.json", "w+");
    fwrite($f, json_encode($novoGrafico));
    fclose($f);
}
$data['data'] = 1;