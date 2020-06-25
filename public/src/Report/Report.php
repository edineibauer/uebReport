<?php

namespace Report;

use Conn\Read;
use Conn\SqlCommand;
use Entity\Meta;
use Entity\Metadados;

class Report
{
    private $report;
    private $result = [];
    private $queryDeclaration = [];
    private $limit = 1000000;
    private $offset = 0;
    private $total = 0;

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

    /**
     * @return int
     */
    public function getTotal(): int
    {
        return $this->total;
    }

    private function start()
    {
        $querySelect = "SELECT {$this->report['entidade']}.*";
        $this->queryDeclaration[$this->report['entidade']] = ["tipo" => "FROM", "on" => ""];
        $queryLogic = "WHERE";

        if(!empty($this->report['search'])) {
            foreach (Metadados::getDicionario($this->report['entidade']) as $meta) {
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

        $queryDeclarationString = "";
        foreach ($this->queryDeclaration as $entity => $logic)
            $queryDeclarationString .= ($queryDeclarationString !== "" ? " " : "") . "{$logic['tipo']} " . PRE . $entity . " as {$entity}" . (!empty($logic['on']) ? " ON " . $logic['on'] : "");

        $queryOrder = "ORDER BY " . $this->report['entidade'] . "." . (!empty($this->report['ordem']) ? $this->report['ordem'] : "id") . ($this->report['decrescente'] === null || $this->report['decrescente'] ? " DESC" : " ASC") . " LIMIT {$this->limit}" . (!empty($this->offset) && $this->offset > 0 ? " OFFSET " . $this->offset : "");

        $queryGroup = "";
        if(!empty($this->report['agrupamento'])) {
            $queryGroup = "GROUP BY {$this->report['entidade']}." . $this->report['agrupamento'];
            $querySelect .= ", COUNT({$this->report['entidade']}.id) as contagem";

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

        $query = $querySelect . " " . $queryDeclarationString . " " . ($queryLogic !== "WHERE" ? $queryLogic . " " : "") . $queryGroup . " " . $queryOrder;

        /**
         * Executa a leitura no banco de dados
         */
        $sql = new SqlCommand();
        $sql->exeCommand($query);
        if (!$sql->getErro() && $sql->getResult()) {
            $this->result = $sql->getResult();

            $query = $querySelect . " " . $queryDeclarationString . " " . ($queryLogic !== "WHERE" ? $queryLogic . " " : "") . $queryGroup;
            $sql->exeCommand($query);
            if (!$sql->getErro() && $sql->getResult())
                $this->total = $sql->getRowCount();
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
                    $query .= " {$column} < CURDATE() - INTERVAL {$valor} DAY";
                    break;
                case 'menor igual a hoje - X dias':
                    $query .= " {$column} <= CURDATE() - INTERVAL {$valor} DAY";
                    break;
                case 'maior que hoje - X dias':
                    $query .= " {$column} > CURDATE() - INTERVAL {$valor} DAY";
                    break;
                case 'maior igual a hoje - X dias':
                    $query .= " {$column} >= CURDATE() - INTERVAL {$valor} DAY";
            }
        }

        return $query;
    }
}