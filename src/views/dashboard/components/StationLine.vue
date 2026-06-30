<template>
  <div :class="className" ref="charRef" :style="{height:height,width:width}" />
</template>

<script setup>
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  className: {
    type: String,
    default: 'chart'
  },
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '350px'
  },
  autoResize: {
    type: Boolean,
    default: true
  },
  chartData: {
    type: Object,
    default: () => {
      return {
        yData: [79,65, 21, 67, 21, 89, 56],
        xData: ['09-22','09-23','09-24','09-25','09-26','09-27','09-28']
      }
    }
    // required: true
  },
  yName: {
    type: String,
    default: '次'
  },
  xName: {
    type: String,
    default: '日'
  },
  seriesName: {
    type: String,
    default: '充电次数'
  },
  itemColor: {
    type: String,
    default: ''
  },
  seriesData: {
    type: Array,
    default: null
  }
});

const chart = ref(null);

const charRef = ref(null)

watch(()=>props.chartData, (value) => {
  nextTick(() => {
    if (!chart.value) {
      return;
    }
    setOptions();
  });
})

watch(()=>props.seriesData, (value) => {
  nextTick(() => {
    if (!chart.value) {
      return;
    }
    setOptions();
  });
}, { deep: true })

onMounted(()=>{
  nextTick(()=>{
    initChart()
  })
})

onBeforeUnmount(()=>{
  if (!chart.value) {
    return
  }
  chart.value.dispose()
  chart.value = null
})

function initChart() {
  chart.value = echarts.init(charRef.value, 'lightTheme')
  setOptions()
}
// ... existing code ...
function setOptions() {
  const isMultiSeries = props.seriesData && props.seriesData.length > 0

  // 定义颜色数组，用于多系列模式
  const colorPalette = [
    '#5470c6', // 蓝色
    '#91cc75', // 绿色
    '#fac858', // 黄色
    '#ee6666', // 红色
    '#73c0de', // 青色
    '#3ba272', // 深绿
    '#fc8452', // 橙色
    '#9a60b4', // 紫色
    '#ea7ccc'  // 粉色
  ]

  chart.value.setOption({
    color: isMultiSeries ? colorPalette : undefined,
    xAxis: {
      name: props.xName,
      data: props.chartData.xData,
      boundaryGap: false,
      axisTick: {
        show: false
      },
      axisLabel: {
        rotate: isMultiSeries ? 45 : 0,
        interval: 'auto'
      }
    },
    grid: {
      top: isMultiSeries ? '22%' : '15%',
      left: '2%',
      right: '10%',
      bottom: '0%',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      padding: [5, 10]
    },
    dataZoom: {
      show: true,
      type: 'inside'
    },
    yAxis: {
      name: props.yName,
      axisTick: {
        show: false
      }
    },
    legend: isMultiSeries ? {
      data: props.seriesData.map(s => s.name),
      top: '0%',
      itemWidth: 16,
      itemHeight: 8,
      textStyle: {
        fontSize: 12
      }
    } : undefined,
    series: isMultiSeries ? props.seriesData.map((series, index) => ({
      name: series.name,
      type: 'line',
      smooth: true,
      data: series.data,
      showSymbol: true,
      symbolSize: 6,
      itemStyle: {
        color: colorPalette[index % colorPalette.length]
      },
      lineStyle: {
        width: 2,
        color: colorPalette[index % colorPalette.length]
      },
      animationDuration: 1500,
      animationEasing: 'cubicInOut'
    })) : [{
      name: props.seriesName,
      itemStyle: {
        color: props.itemColor || '#5470c6',
      },
      lineStyle: {
        width: 4
      },
      areaStyle: {
        opacity: 0.6,
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          {
            offset: 0,
            color: props.itemColor || '#5470c6'
          },
          {
            offset: 1,
            color: 'rgba(255, 255, 255, .255)'
          }
        ])
      },
      smooth: true,
      type: 'line',
      data: props.chartData.yData,
      animationDuration: 1500,
      animationEasing: 'cubicInOut',
    }]
  })
}

</script>
