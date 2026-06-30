<template>
  <div class="app-container">
    <el-card>
      <el-form :model="queryParams" ref="queryRef" :inline="true" label-width="68px">
        <el-row :gutter="0" style="display: flex; flex-wrap: wrap; align-items: flex-start;">
          <el-form-item label="订单类型" prop="orderType">
            <el-radio-group v-model="queryParams.orderType" @change="handleQuery">
              <el-radio-button
                :key="-1"
                :label="-1"
              >
                全部
              </el-radio-button>
              <el-radio-button
                v-for="item in wms_inventory_history_type"
                :key="item.value"
                :label="item.value"
              >
                {{ item.label }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="仓库" prop="warehouseId">
            <el-select style="width: 100%" v-model="queryParams.warehouseId" placeholder="请选择仓库"
                       filterable clearable>
              <el-option v-for="item in useWmsStore().warehouseList" :key="item.id" :label="item.warehouseName"
                         :value="item.id"/>
            </el-select>
          </el-form-item>
          <el-form-item label="操作单号" prop="orderNo">
            <el-input v-model="queryParams.orderNo" clearable placeholder="请输入操作单号"></el-input>
          </el-form-item>
          <el-form-item label="商品名称" prop="itemName">
            <el-input v-model="queryParams.itemName" clearable placeholder="请输入商品名称" style="width: 300px;"></el-input>
          </el-form-item>
          <el-form-item label="商品编号" prop="itemCode">
            <el-input v-model="queryParams.itemCode" clearable placeholder="请输入商品编号" style="width: 217px;"></el-input>
          </el-form-item>
          <el-form-item label="规格名称" prop="skuName">
            <el-input v-model="queryParams.skuName" clearable placeholder="请输入规格名称"></el-input>
          </el-form-item>
          <el-form-item label="规格编号" prop="skuCode">
            <el-input v-model="queryParams.skuCode" clearable placeholder="请输入规格编号"></el-input>
          </el-form-item>
          <el-form-item label="操作时间" prop="createTimeRange">
            <el-date-picker
              v-model="queryParams.createTimeRange"
              type="datetimerange"
              range-separator="至"
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              :default-time="defaultTime"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
            />
          </el-form-item>
          <el-form-item style="margin-left: auto">
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-row>
      </el-form>
    </el-card>

    <el-card class="mt20">
      <el-row :gutter="10" class="mb8" type="flex" justify="space-between">
        <el-col :span="6"><span style="font-size: large">库存记录</span></el-col>
        <el-col :span="1.5" style="text-align: right">
          <el-button type="success" plain icon="Download" :loading="exportLoading" @click="handleExport">导出excel</el-button>
        </el-col>
      </el-row>
      <el-table v-loading="loading" :data="inventoryHistoryList" border class="mt20" empty-text="暂无库存记录" cell-class-name="vertical-top-cell">
        <el-table-column label="操作单号" prop="orderNo" min-width="160" show-overflow-tooltip/>
        <el-table-column label="商品名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.item.itemName }}
          </template>
        </el-table-column>
        <el-table-column label="商品编号" align="center" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.item.itemCode }}
          </template>
        </el-table-column>
        <el-table-column label="供应商" align="center" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.item.unit ? useWmsStore().merchantMap.get(String(row.item.unit))?.merchantName : '' }}
          </template>
        </el-table-column>
        <el-table-column label="规格信息" min-width="150">
          <template #default="{ row }">
            <div>{{ row.itemSku.skuName }}</div>
            <div v-if="row.itemSku.skuCode">规格编号：{{ row.itemSku.skuCode }}</div>
          </template>
        </el-table-column>
        <el-table-column label="订单类型" align="center" min-width="100">
          <template #default="{ row }">
            <dict-tag :options="wms_inventory_history_type" :value="row.orderType"/>
          </template>
        </el-table-column>
        <el-table-column label="仓库" min-width="120">
          <template #default="{ row }">
            <div>{{ useWmsStore().warehouseMap.get(String(row.warehouseId))?.warehouseName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="库位编号" min-width="110">
          <template #default="{ row }">
            <div>{{ row.stockCode || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作前" align="right" min-width="100">
          <template #default="{ row }">
            <div>
              <el-statistic :value="Number(row.beforeQuantity)" :precision="0" v-if="row.beforeQuantity"/>
              <span v-else>-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作后" align="right" min-width="100">
          <template #default="{ row }">
            <div>
              <el-statistic :value="Number(row.afterQuantity)" :precision="0" v-if="row.afterQuantity"/>
              <span v-else>-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="数量/金额(元)" min-width="160">
          <template #default="{ row }">
            <div class="flex-space-between">
              <div>数量：</div>
              <el-statistic :value="Number(row.quantity)" :precision="0"/>
            </div>
            <div class="flex-space-between" v-if="row.amount || row.amount === 0">
              <div>金额：</div>
              <el-statistic :value="Number(row.amount)" :precision="2"/>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作时间" prop="createTime" min-width="170"/>
      </el-table>

      <el-row>
        <pagination
          v-show="total>0"
          :total="total"
          v-model:page="queryParams.pageNum"
          v-model:limit="queryParams.pageSize"
          @pagination="getList"
        />
      </el-row>

    </el-card>
  </div>
</template>

<script setup name="InventoryHistory">
import {listInventoryHistory} from "@/api/wms/inventoryHistory";
import {getCurrentInstance, reactive, ref} from "vue";
import {useWmsStore} from '@/store/modules/wms'
import * as XLSX from 'xlsx'
import {saveAs} from 'file-saver'
const defaultTime = reactive([new Date(0,0,0,0,0,0), new Date(0,0,0,23,59,59)])
const {proxy} = getCurrentInstance();
const {wms_inventory_history_type} = proxy.useDict('wms_inventory_history_type');

const inventoryHistoryList = ref([]);
const loading = ref(true);
const total = ref(0);
const queryRef = ref(null)
const queryParams = ref({
  pageNum: 1,
  pageSize: 10,
  orderType: -1,
  orderNo: undefined,
  itemName: undefined,
  itemCode: undefined,
  skuName: undefined,
  skuCode: undefined,
  warehouseId: undefined,
  merchantId: undefined,
})

/** 查询往来单位列表 */
function getList() {
  const query = {...queryParams.value}
  if (query.orderType === -1) {
    query.orderType = null
  }
  if (query.createTimeRange) {
    query.startTime = query.createTimeRange[0]
    query.endTime = query.createTimeRange[1]
  }
  loading.value = true;
  listInventoryHistory(query).then(response => {
    inventoryHistoryList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm("queryRef");
  handleQuery();
}

/** 导出库存记录 */
const exportLoading = ref(false);
const handleExport = async () => {
  exportLoading.value = true;
  try {
    const query = {
      ...queryParams.value,
      pageNum: 1,
      pageSize: 99999,
      ...(queryParams.value.createTimeRange ? {
        startTime: queryParams.value.createTimeRange[0],
        endTime: queryParams.value.createTimeRange[1]
      } : {})
    };
    if (query.orderType === -1) {
      query.orderType = null;
    }
    const res = await listInventoryHistory(query);
    const rows = res.rows || [];

    if (rows.length === 0) {
      proxy?.$modal.msgWarning('没有可导出的数据');
      return;
    }

    const store = useWmsStore();
    const getTypeLabel = (val) => {
      const dict = wms_inventory_history_type.value?.find(d => d.value === String(val));
      return dict ? dict.label : (val || '');
    };

    const exportData = rows.map(row => ({
      '操作单号': row.orderNo || '',
      '商品名称': row.item?.itemName || '',
      '商品编号': row.item?.itemCode || '',
      '供应商': row.item?.unit ? (store.merchantMap.get(String(row.item.unit))?.merchantName || '') : '',
      '规格名称': row.itemSku?.skuName || '',
      '规格编号': row.itemSku?.skuCode || '',
      '订单类型': getTypeLabel(row.orderType),
      '仓库': store.warehouseMap.get(String(row.warehouseId))?.warehouseName || '',
      '库位编号': row.stockCode || '-',
      '操作前': row.beforeQuantity ? Number(row.beforeQuantity) : '',
      '操作后': row.afterQuantity ? Number(row.afterQuantity) : '',
      '数量': Number(row.quantity) || 0,
      '金额(元)': (row.amount || row.amount === 0) ? Number(row.amount) : '',
      '操作时间': row.createTime || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 14 },
      { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存记录');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `库存记录_${new Date().getTime()}.xlsx`);
  } catch (e) {
    proxy?.$modal.msgError('导出失败：' + (e.message || e));
  } finally {
    exportLoading.value = false;
  }
}

getList();
useWmsStore().getMerchantList();
</script>
<style lang="scss">
.el-statistic__content {
  font-size: 14px;
}
.el-table .vertical-top-cell {
  vertical-align: top
}
</style>
