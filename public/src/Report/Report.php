<?php

namespace Report;

use Conn\Read;
use Conn\SqlCommand;
use Entity\Entity;
use Entity\Meta;
use Entity\Metadados;

class Report
{
    private $report;
    private $result = [];
    private $queryDeclaration = [];
    private $limit = 1000000;
    private $offset = 0;

    /**
     * Report constructor.
     * @param int|array $report
     * @param int|null $limit
     * @param int|null $offset
     */
    public function __construct($report, int $limit = null, int $offset = null)
    {
        if (is_int($report)) {
            $read = new Read();
            $read->exeRead("relatorios", "WHERE id = :id", "id={$report}");
            $this->report = $read->getResult() ? $read->getResult()[0] : [];
        } elseif (is_array($report)) {
            $this->report = $report;
        }

//        $this->report['voltar_data_de_exibicao'] = (!empty($this->report['voltar_data_de_exibicao']) && is_numeric($this->report['voltar_data_de_exibicao']) ? ($this->report['voltar_data_de_exibicao'] < 0 ? $this->report['voltar_data_de_exibicao'] * -1 : $this->report['voltar_data_de_exibicao']) : 0);
        $this->report['voltar_data_de_exibicao'] = 0;

        if (!empty($limit))
            $this->limit = $limit;

        if (!empty($offset))
            $this->offset = $offset;

        if (is_array($this->report) && !empty($this->report))
            $this->start();
    }

    /**
     * @param int $limit
     */
    public function setLimit(int $limit): void
    {
        $this->limit = $limit;
    }

    /**
     * @param int $offset
     */
    public function setOffset(int $offset): void
    {
        $this->offset = $offset;
    }

    /**
     * @return array
     */
    public function getResult(): array
    {
        return $this->result;
    }

    /**
     * @return array
     */
    public function getReport(): array
    {
        return $this->report;
    }

    private function start()
    {
        $info = Metadados::getInfo($this->report['entidade']);
        $dicionario = Metadados::getDicionario($this->report['entidade']);
        $querySelect = "";
        $queryDeclarationString = "FROM " . PRE . $this->report['entidade'] . " as " . $this->report['entidade'];
        $relations = [];

        /**
         * Select the own entity fields
         */
        if (!empty($info['columns_readable'])) {
            foreach ($info['columns_readable'] as $column)
                $querySelect .= ($querySelect === "" ? "" : ", ") . "{$this->report['entidade']}.{$column}";
        }

        /**
         * System id relation
         */
        if (!empty($info['system'])) {
            $infSystem = Metadados::getInfo($info['system']);
            if (!empty($infSystem['columns_readable'])) {
                foreach ($infSystem['columns_readable'] as $column)
                    $querySelect .= ", system_" . $info['system'] . ".{$column} as {$info['system']}___{$column}";
            }

            $queryDeclarationString .= " LEFT JOIN " . PRE . $info['system'] . " as system_" . $info['system'] . " ON system_" . $info['system'] . ".id = {$this->report['entidade']}.system_id";
        }

        /**
         * Autorpub and Ownerpub id relation
         */
        if (!empty($info['autor'])) {
            $infAutor = Metadados::getInfo("usuarios");
            if (!empty($infAutor['columns_readable'])) {
                foreach ($infAutor['columns_readable'] as $column)
                    $querySelect .= ", autor_user.{$column} as autor_user___{$column}";
            }

            $queryDeclarationString .= " LEFT JOIN " . PRE . "usuarios as autor_user ON autor_user.id = {$this->report['entidade']}." . ($info['autor'] == 1 ? "autorpub" : "ownerpub");
        }

        /**
         * Include the data from each relation
         */
        if (!empty($info['relation'])) {
            foreach ($info['relation'] as $relationItem) {
                $relationEntity = $dicionario[$relationItem]['relation'];
                $relations[$dicionario[$relationItem]['column']] = $relationEntity;

                $infoRelation = Metadados::getInfo($relationEntity);
                if (!empty($infoRelation['columns_readable'])) {
                    foreach ($infoRelation['columns_readable'] as $column)
                        $querySelect .= ", data_" . $dicionario[$relationItem]['column'] . ".{$column} as {$dicionario[$relationItem]['relation']}___{$column}";
                }

                $queryDeclarationString .= " LEFT JOIN " . PRE . $dicionario[$relationItem]['relation'] . " as data_" . $dicionario[$relationItem]['column'] . " ON data_" . $dicionario[$relationItem]['column'] . ".id = {$this->report['entidade']}." . $dicionario[$relationItem]['column'];
            }
        }

        $queryLogic = "WHERE";

        if(!empty($this->report['search'])) {
            foreach ($dicionario as $meta) {
                if(!in_array($meta['key'], ["information", "identifier"]))
                    $queryLogic .= ($queryLogic === "WHERE" ? " (" : " || ") . $meta['column'] . " LIKE '%{$this->report['search']}%'";
            }
            $queryLogic .= ")";
        }

        if (!empty($this->report['regras'])) {
            $regras = json_decode($this->report['regras'], !0);
            if (is_array($regras)) {
                foreach ($regras as $regra) {
                    $query = "";
                    if (!empty($regra['grupos'])) {
                        foreach ($regra['grupos'] as $i => $grupo) {
                            if (!empty($grupo['filtros']))
                                $query .= ($i > 0 ? " " . strtoupper($grupo['filtros'][0]['logica']) : "") . " (" . $this->getFilterQuery($grupo['filtros']) . ")";
                        }
                    }

                    if ($regra['tipo'] === 'select') {
                        $queryLogic .= $query;
                    } elseif ($regra['tipo'] === "inner_join") {
                        $queryLogic .= " " . strtoupper($grupo['filtros'][0]['logica']) . " {$this->report['entidade']}.{$regra['tipoColumn']} IN ( SELECT {$this->report['entidade']}.{$regra['tipoColumn']} FROM " . PRE . $this->report['entidade'] . " as {$this->report['entidade']} WHERE{$query})";
                    } elseif ($regra['tipo'] === "outer_join") {
                        $queryLogic .= " " . strtoupper($grupo['filtros'][0]['logica']) . " {$this->report['entidade']}.{$regra['tipoColumn']} NOT IN ( SELECT {$this->report['entidade']}.{$regra['tipoColumn']} FROM " . PRE . $this->report['entidade'] . " as {$this->report['entidade']} WHERE{$query})";
                    }
                }
            }
        }

        foreach ($this->queryDeclaration as $entity => $logic)
            $queryDeclarationString .= " {$logic['tipo']} " . PRE . $entity . " as {$entity}" . (!empty($logic['on']) ? " ON " . $logic['on'] : "");

        $queryOrder = "ORDER BY " . (!in_array($this->report['ordem'], ["total", "contagem"]) ? $this->report['entidade'] . "." : "") . (!empty($this->report['ordem']) ? $this->report['ordem'] : "id") . ($this->report['decrescente'] === null || $this->report['decrescente'] ? " DESC" : " ASC");

        $queryGroup = "";
        if(!empty($this->report['agrupamento'])) {
            $queryGroup = "GROUP BY {$this->report['entidade']}." . $this->report['agrupamento'];
            $querySelect .= ", COUNT({$this->report['entidade']}.id) as contagem, COUNT({$this->report['entidade']}.id) as total";

            $soma = (!empty($this->report['soma'])) ? json_decode($this->report['soma'], !0) : [];
            $media = (!empty($this->report['media'])) ? json_decode($this->report['media'], !0) : [];
            $maior = (!empty($this->report['maior'])) ? json_decode($this->report['maior'], !0) : [];
            $menor = (!empty($this->report['menor'])) ? json_decode($this->report['menor'], !0) : [];

            if(!empty($soma)) {
                foreach ($soma as $item)
                    $querySelect .= ", SUM({$this->report['entidade']}.{$item}) as {$item}";
            }
            if(!empty($media)) {
                foreach ($media as $item)
                    $querySelect .= ", AVG({$this->report['entidade']}.{$item}) as {$item}";
            }
            if(!empty($maior)) {
                foreach ($maior as $item)
                    $querySelect .= ", MAX({$this->report['entidade']}.{$item}) as {$item}";
            }
            if(!empty($menor)) {
                foreach ($menor as $item)
                    $querySelect .= ", MIN({$this->report['entidade']}.{$item}) as {$item}";
            }
        } else {
            $querySelect .= ", 1 as contagem";
        }

        $query = "SELECT " . $querySelect . " " . $queryDeclarationString . " " . ($queryLogic !== "WHERE" ? $queryLogic . " " : "") . $queryGroup . " " . $queryOrder . " LIMIT " . $this->limit . " OFFSET " . $this->offset;

        /**
         * Executa a leitura no banco de dados
         */
        $sql = new SqlCommand();
        $sql->exeCommand($query);
        if (!$sql->getErro() && $sql->getResult()) {
            foreach ($sql->getResult() as $i => $register) {
                /**
                 * Work on a variable with the data of relationData
                 */
                $relationData = [];

                /**
                 * Decode all json on base register
                 */
                foreach ($dicionario as $meta) {
                    $m = new \Entity\Meta($meta);
                    $m->setValue($register[$meta['column']]);
                    $register[$meta['column']] = $m->getValue();
                }

                /**
                 * Foreach register, check if have relationData to split
                 */
                foreach ($register as $column => $value) {

                    /**
                     * Check System ID relation
                     * Add item to a relation register system_id
                     * Remove item from base register
                     */
                    if (!empty($info['system']) && strpos($column, $info['system'] . '___') !== false) {
                        $relationData["system_id"][str_replace($info['system'] . "___", "", $column)] = $value;
                        unset($register[$column]);
                    }

                    /**
                     * Autorpub and Ownerpub id relation
                     * Add item to a relation register
                     * Remove item from base register
                     */
                    if (!empty($info['autor']) && strpos($column, 'autor_user___') !== false) {
                        $relationData["usuarios"][str_replace("autor_user___", "", $column)] = $value;
                        unset($register[$column]);
                    }

                    /**
                     * If have relation data together in the base register
                     */
                    if (!empty($relations)) {
                        foreach ($relations as $RelationColumn => $relation) {
                            if (strpos($column, $relation . '___') !== false) {

                                /**
                                 * Add item to a relation register
                                 * Remove item from base register
                                 */
                                $relationData[$RelationColumn][str_replace($relation . "___", "", $column)] = $value;
                                unset($register[$column]);
                            }
                        }
                    }
                }

                if(!empty($info['system'])) {
                    /**
                     * Check if the struct of relation data received have a ID
                     * if not, so delete
                     */
                    if (empty($relationData["system_id"]['id'])) {
                        unset($relationData["system_id"]);

                    } else {

                        /**
                         * Decode all json on base relation register
                         */
                        foreach (Metadados::getDicionario($info['system']) as $meta) {
                            $m = new \Entity\Meta($meta);
                            $m->setValue($relationData["system_id"][$meta['column']]);
                            $relationData["system_id"][$meta['column']] = $m->getValue();
                        }
                    }
                }

                if(!empty($info['autor']) && !empty($relationData["usuarios"])) {
                    /**
                     * Check if the struct of relation data received have a ID
                     * if not, so delete
                     */
                    if (empty($relationData["usuarios"]['id'])) {
                        unset($relationData["usuarios"]);

                    } else {

                        /**
                         * Decode all json on base relation register
                         */
                        foreach (Metadados::getDicionario("usuarios") as $meta) {
                            $m = new \Entity\Meta($meta);
                            $m->setValue($relationData["usuarios"][$meta['column']]);
                            $relationData["usuarios"][$meta['column']] = $m->getValue();
                        }

                        $relationData[$info['autor'] == 1 ? "autorpub" : "ownerpub"] = $relationData["usuarios"];
                        unset($relationData["usuarios"]);
                    }
                }

                /**
                 * After separate the base data from the relation data
                 * check if the relation data have a ID an decode json
                 */
                if (!empty($relations)) {
                    foreach ($relations as $RelationColumn => $relation) {

                        /**
                         * Check if the struct of relation data received have a ID
                         * if not, so delete
                         */
                        if (empty($relationData[$RelationColumn]['id'])) {
                            unset($relationData[$RelationColumn]);

                        } else {

                            /**
                             * Decode all json on base relation register
                             */
                            foreach (Metadados::getDicionario($relation) as $meta) {
                                $m = new \Entity\Meta($meta);
                                $m->setValue($relationData[$RelationColumn][$meta['column']]);
                                $relationData[$RelationColumn][$meta['column']] = $m->getValue();
                            }

                            /**
                             * If is a user relation entity add the relationData
                             */
                            foreach ($dicionario as $meta) {
                                if($meta['column'] === $RelationColumn && $meta['relation'] === "usuarios" && !empty($relationData[$RelationColumn]['setor'])) {
                                    $relationData[$RelationColumn]['relationData'][$relationData[$RelationColumn]['setor']] = Entity::getUserSetorData($relationData[$RelationColumn]['setor'], $relationData[$RelationColumn]['id']);
                                    break;
                                }
                            }
                        }
                    }
                }

                $register["relationData"] = $relationData;
                $this->result[] = $register;
            }

            /**
             * if is user database, include the setor data relation
             * Or if have Autorpub or Ownerpub, so include the setor data relation
             */
            if ($this->report['entidade'] === "usuarios" || !empty($info['autor'])) {
                foreach ($this->result as $i => $item) {
                    $entitySetor = ($this->report['entidade'] === "usuarios" ? $item['setor'] : ($info['autor'] == 1 ? $item['relationData']["autorpub"]['setor'] : $item['relationData']["ownerpub"]['setor']));
                    if (!empty($entitySetor)) {
                        $idUsuario = ($this->report['entidade'] === "usuarios" ? $item['id'] : ($info['autor'] == 1 ? $item['relationData']["autorpub"]['id'] : $item['relationData']["ownerpub"]['id']));

                        if ($this->report['entidade'] === "usuarios")
                            $this->result[$i]['relationData'][$entitySetor] = Entity::getUserSetorData($entitySetor, $idUsuario);
                        else
                            $this->result[$i]['relationData'][($info['autor'] == 1 ? "autorpub" : "ownerpub")]["relationData"][$entitySetor] = Entity::getUserSetorData($entitySetor, $idUsuario);
                    }
                }
            }
        }
    }

    /**
     * @param array $filter
     * @return string
     */
    private function getFilterQuery(array $filter)
    {
        $query = "";
        foreach ($filter as $i => $filterOption) {

            if($filterOption['coluna'] === "ownerpub" OR $filterOption['coluna'] === "system_id")
                continue;

            if ($i > 0)
                $query .= " " . strtoupper($filterOption['logica']);

            $colunas = json_decode($filterOption['colunas'], !0);
            $entidades = json_decode($filterOption['entidades'], !0);

            if (count($colunas) > 1) {
                /**
                 * Adiciona entidades externas para concatenação JOIN
                 */
                $entityParent = "";
                foreach ($entidades as $ii => $entidade) {
                    if ($ii > 0 && !isset($this->queryDeclaration[$entidade]))
                        $this->queryDeclaration[$entidade] = ["tipo" => "INNER JOIN", "on" => "{$entityParent} = {$entidade}.id"];

                    $entityParent = $entidade . "." . $colunas[$ii];
                }
                $column = $entidades[count($entidades) - 1] . "." . $filterOption['coluna'];
                $dicionario = Metadados::getDicionario($entidades[count($entidades) - 1]);
            } else {
                $column = $entidades[0] . "." . $filterOption['coluna'];
                $dicionario = Metadados::getDicionario($entidades[0]);
            }

            /**
             * Convert uso de variável do front USER como valor
             */
            if(preg_match("/^USER./i", $filterOption['valor'])) {
                $fields = explode(".", str_replace("USER.", "", $filterOption['valor']));
                if(count($fields) > 0 && count($fields) < 5)
                    $filterOption['valor'] = (!empty($fields[4]) ? $_SESSION['userlogin'][$fields[0]][$fields[1]][$fields[2]][$fields[3]][$fields[4]] : (!empty($fields[3]) ? $_SESSION['userlogin'][$fields[0]][$fields[1]][$fields[2]][$fields[3]] : (!empty($fields[2]) ? $_SESSION['userlogin'][$fields[0]][$fields[1]][$fields[2]] : (!empty($fields[1]) ? $_SESSION['userlogin'][$fields[0]][$fields[1]] : $_SESSION['userlogin'][$fields[0]]))));
            }

            /**
             * Transforma valor do campo no padrão para o campo
             */
            $valor = $filterOption['valor'];
            $valorTipado = $valor;
            $tipo = "varchar";
            foreach ($dicionario as $item) {
                if ($item['column'] === $filterOption['coluna']) {
                    $meta = new Meta($item);
                    $meta->setValue($valor);
                    $tipo = $meta->getType();
                    $valorTipado = $meta->getValue();
                    break;
                }
            }

            if(!in_array($tipo, ["int", "tinyint", "double", "decimal", "float", "smallint"]))
                $valorTipado = '"' . str_replace('"', "'", $valor) . '"';

            switch ($filterOption['operador']) {
                case 'contém':
                    $query .= " {$column} LIKE '%{$valor}%'";
                    break;
                case 'igual a':
                    $query .= " {$column} = {$valorTipado}";
                    break;
                case 'diferente de':
                    $query .= " {$column} != {$valorTipado}";
                    break;
                case 'começa com':
                    $query .= " {$column} LIKE '{$valor}%'";
                    break;
                case 'termina com':
                    $query .= " {$column} LIKE '%{$valor}'";
                    break;
                case 'maior que':
                    $query .= " {$column} > {$valorTipado}";
                    break;
                case 'menor que':
                    $query .= " {$column} < {$valorTipado}";
                    break;
                case 'maior igual a':
                    $query .= " {$column} >= {$valorTipado}";
                    break;
                case 'menor igual a':
                    $query .= " {$column} <= {$valorTipado}";
                    break;
                case 'menor que hoje - X dias':
                    $actualDate = $this->report['voltar_data_de_exibicao'] > 0 ? "DATE_SUB(CURDATE(), INTERVAL -{$this->report['voltar_data_de_exibicao']} DAY)" : "CURDATE()";
                    $query .= " {$column} < {$actualDate} - INTERVAL {$valor} DAY";
                    break;
                case 'menor igual a hoje - X dias':
                    $actualDate = $this->report['voltar_data_de_exibicao'] > 0 ? "DATE_SUB(CURDATE(), INTERVAL -{$this->report['voltar_data_de_exibicao']} DAY)" : "CURDATE()";
                    $query .= " {$column} <= {$actualDate} - INTERVAL {$valor} DAY";
                    break;
                case 'maior que hoje - X dias':
                    $actualDate = $this->report['voltar_data_de_exibicao'] > 0 ? "DATE_SUB(CURDATE(), INTERVAL -{$this->report['voltar_data_de_exibicao']} DAY)" : "CURDATE()";
                    $query .= " {$column} > {$actualDate} - INTERVAL {$valor} DAY";
                    break;
                case 'maior igual a hoje - X dias':
                    $actualDate = $this->report['voltar_data_de_exibicao'] > 0 ? "DATE_SUB(CURDATE(), INTERVAL -{$this->report['voltar_data_de_exibicao']} DAY)" : "CURDATE()";
                    $query .= " {$column} >= {$actualDate} - INTERVAL {$valor} DAY";
                    break;
                case 'no dia de hoje':
                    $actualDate = $this->report['voltar_data_de_exibicao'] > 0 ? "DATE_SUB(CURDATE(), INTERVAL -{$this->report['voltar_data_de_exibicao']} DAY)" : "CURDATE()";
                    $query .= " DATE({$column}) = {$actualDate}";
                    break;
                case 'nesta semana':
                    $actualDate = $this->report['voltar_data_de_exibicao'] > 0 ? "DATE_SUB(CURDATE(), INTERVAL -{$this->report['voltar_data_de_exibicao']} WEEK)" : "CURRENT_DATE()";
                    $query .= " YEARWEEK({$column}) = YEARWEEK({$actualDate})";
                    break;
                case 'neste mês':
                    $actualDate = $this->report['voltar_data_de_exibicao'] > 0 ? "DATE_SUB(CURDATE(), INTERVAL -{$this->report['voltar_data_de_exibicao']} MONTH)" : "CURRENT_DATE()";
                    $query .= " MONTH({$column}) = MONTH({$actualDate}) AND YEAR({$column}) = YEAR({$actualDate})";
                    break;
                case 'neste ano':
                    $actualDate = $this->report['voltar_data_de_exibicao'] > 0 ? "DATE_SUB(CURDATE(), INTERVAL -{$this->report['voltar_data_de_exibicao']} YEAR)" : "CURRENT_DATE()";
                    $query .= " YEAR({$column}) = YEAR({$actualDate})";
            }
        }

        return $query;
    }
}