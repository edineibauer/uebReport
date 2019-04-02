<?php

namespace Report;

class Chart
{
    private $columnDate;
    private $data;
    private $title;
    private $x;
    private $y;
    private $type;
    private $mensagem;
    private $template;
    private $cores;
    private $time;

    /**
     * @param array $data
     */
    public function setData(array $data)
    {
        $this->data = $data;
    }

    /**
     * @param string $columnDate
     */
    public function setColumnDate(string $columnDate)
    {
        $this->columnDate = $this->dateFilter($this->columnDate, $columnDate);
    }

    /**
     * @param int|mixed $time
     */
    public function setTime($time)
    {
        $this->time = $time;

        if (in_array($this->time, ['all', 'week', 'last-week', 'month', 'last-month', 'year', 'last-year'])) {
            if ($this->time === "week")
                $this->columnDate = "WHERE YEARWEEK({{column}}) = YEARWEEK(NOW())";
            elseif ($this->time === "last-week")
                $this->columnDate = "WHERE YEARWEEK({{column}}) = YEARWEEK(NOW() - INTERVAL 1 WEEK)";
            elseif ($this->time === "month")
                $this->columnDate = "WHERE MONTH({{column}}) = MONTH(NOW())";
            elseif ($this->time === "last-month")
                $this->columnDate = "WHERE MONTH({{column}}) = MONTH(NOW() - INTERVAL 1 MONTH)";
            elseif ($this->time === "year")
                $this->columnDate = "WHERE YEAR({{column}}) = YEAR(NOW())";
            elseif ($this->time === "last-year")
                $this->columnDate = "WHERE YEAR({{column}}) = YEAR(NOW() - INTERVAL 1 YEAR)";
            elseif ($this->time === "all")
                $this->columnDate = "";
        } else {
            $this->columnDate = "WHERE {{column}} BETWEEN NOW() - INTERVAL {$this->time} DAY AND NOW()";
        }
    }
    /**
     * @param array $cores
     */
    public function setCores(array $cores)
    {
        $this->cores = $cores;
    }

    /**
     * @param string $mensagem
     */
    public function setMensagem(string $mensagem)
    {
        $this->mensagem = $mensagem;
    }

    /**
     * @param string $template
     */
    public function setTemplate(string $template)
    {
        $this->template = $template;
    }

    /**
     * @param string $title
     */
    public function setTitle(string $title)
    {
        $this->title = $title;
    }

    /**
     * @param mixed $type
     */
    public function setType($type)
    {
        $this->type = $type;
    }

    /**
     * @param string $x
     */
    public function setX(string $x)
    {
        $this->x = $x;
    }

    /**
     * @param mixed $y
     */
    public function setY($y)
    {
        if (is_string($y))
            $this->y = [$y];
        elseif (is_array($y))
            $this->y = $y;
    }

    /**
     * @param string|null $column
     * @return string
     */
    public function getWhereDate(string $column = null): string
    {
        if (!empty($column))
            $this->setColumnDate($column);

        return $this->columnDate;
    }

    /**
     * @return array
     */
    public function getData(): array
    {
        if (!empty($this->title) && !empty($this->x) && !empty($this->y)) {
            return [
                "title" => $this->title,
                "x" => $this->x,
                "y" => $this->y,
                "data" => $this->data ?? [],
                "type" => $this->type ?? "bar",
                "time" => $this->time,
                "mensagem" => $this->mensagem,
                "template" => $this->template ?? "chart_table",
                "cores" => $this->cores
            ];
        }
        return [];
    }


    /**
     * @param string $date
     * @param string $column
     * @return string
     */
    private function dateFilter(string $date, string $column): string
    {
        return str_replace("{{column}}", $column, $date);
    }
}