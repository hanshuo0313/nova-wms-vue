<template>
  <div class="app-container">
    <el-card>
      <el-form :model="queryParams" ref="queryRef" label-width="90px" :inline="true"
               style="display: flex; flex-wrap: wrap; align-items: flex-start;">
        <el-form-item class="col4" label="维度 " prop="itemId">
          <el-radio-group v-model="queryType" size="default" @change="handleSortTypeChange">
            <el-radio-button label="warehouse">仓库</el-radio-button>
            <el-radio-button label="item">商品</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item class="col4" label="仓库" prop="warehouseId">
          <el-select style="width: 100%" v-model="queryParams.warehouseId" placeholder="请选择仓库"
                     filterable clearable>
            <el-option v-for="item in useWmsStore().warehouseList" :key="item.id" :label="item.warehouseName"
                       :value="item.id"/>
          </el-select>
        </el-form-item>
        <el-form-item class="col4" label="商品名称" prop="itemName">
          <el-input v-model="queryParams.itemName" clearable placeholder="商品名称"></el-input>
        </el-form-item>
        <el-form-item class="col4" label="商品编号" prop="itemCode">
          <el-input v-model="queryParams.itemCode" clearable placeholder="商品编号"></el-input>
        </el-form-item>
        <el-form-item class="col4" label="商品单位" prop="unit">
          <el-select style="width: 100%" v-model="queryParams.unit" placeholder="请选择单位" filterable clearable>
            <el-option v-for="item in useWmsStore().merchantList" :key="item.id" :label="item.merchantName" :value="item.id"/>
          </el-select>
        </el-form-item>
        <el-form-item class="col4" label="商品分类" prop="itemCategory">
          <el-select style="width: 100%" v-model="queryParams.itemCategory" placeholder="请选择分类" filterable clearable>
            <el-option v-for="item in useWmsStore().itemCategoryList" :key="item.id" :label="item.categoryName" :value="item.id"/>
          </el-select>
        </el-form-item>
        <el-form-item class="col4" label="规格名称" prop="skuName">
          <el-input v-model="queryParams.skuName" clearable placeholder="规格名称"></el-input>
        </el-form-item>
        <el-form-item class="col4" label="规格编号" prop="skuCode">
          <el-input v-model="queryParams.skuCode" clearable placeholder="规格编号"></el-input>
        </el-form-item>
        <el-form-item style="margin-left: auto">
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card class="mt20">
      <div class="mb8 flex-space-between">
        <div style="font-size: large">库存统计</div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <el-checkbox v-model="filterable" label="过滤掉库存为0的商品" size="large" @change="handleChangeFilterZero"/>
          <el-button type="success" plain icon="Download" :loading="exportLoading" @click="handleExport">导出excel</el-button>
        </div>
      </div>
      <el-table :data="inventoryList" border :span-method="spanMethod"
                cell-class-name="vertical-top-cell" v-loading="loading" empty-text="暂无库存">
        <template v-if="queryType == 'warehouse'">
          <el-table-column label="仓库" prop="warehouseId">
            <template #default="{ row }">
              <div>{{ useWmsStore().warehouseMap.get(row.warehouseId)?.warehouseName }}</div>
            </template>
          </el-table-column>
          <el-table-column label="商品名称" prop="itemId" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemName }}
            </template>
          </el-table-column>
          <el-table-column label="商品编号" align="center" min-width="110" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemCode }}
            </template>
          </el-table-column>
          <el-table-column label="商品单位" align="center" min-width="90" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.unit ? useWmsStore().merchantMap.get(row.item.unit)?.merchantName : '' }}
            </template>
          </el-table-column>
          <el-table-column label="商品分类" align="center" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemCategory ? useWmsStore().itemCategoryMap.get(row.item.itemCategory)?.categoryName : '' }}
            </template>
          </el-table-column>
          <el-table-column label="商品级别" align="center" width="90">
            <template #default="{ row }">
              <dict-tag :options="product_level" :value="row.item.itemLevel"/>
            </template>
          </el-table-column>
          <el-table-column label="规格信息" :prop="skuId">
            <template #default="{ row }">
              <div>{{ row.itemSku.skuName }}</div>
              <div v-if="row.itemSku.skuCode">规格编号：{{ row.itemSku.skuCode }}</div>
            </template>
          </el-table-column>
        </template>
        <template v-else>
          <el-table-column label="商品名称" prop="itemId" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemName }}
            </template>
          </el-table-column>
          <el-table-column label="商品编号" align="center" min-width="110" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemCode }}
            </template>
          </el-table-column>
          <el-table-column label="商品单位" align="center" min-width="90" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.unit ? useWmsStore().merchantMap.get(row.item.unit)?.merchantName : '' }}
            </template>
          </el-table-column>
          <el-table-column label="商品分类" align="center" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemCategory ? useWmsStore().itemCategoryMap.get(row.item.itemCategory)?.categoryName : '' }}
            </template>
          </el-table-column>
          <el-table-column label="商品级别" align="center" width="90">
            <template #default="{ row }">
              <dict-tag :options="product_level" :value="row.item.itemLevel"/>
            </template>
          </el-table-column>
          <el-table-column label="规格信息" prop="skuId">
            <template #default="{ row }">
              <div>{{ row.itemSku.skuName }}</div>
              <div v-if="row.itemSku.skuCode">规格编号：{{ row.itemSku.skuCode }}</div>
            </template>
          </el-table-column>
          <el-table-column label="仓库" prop="skuIdAndWarehouseId">
            <template #default="{row}">
              <div>{{ useWmsStore().warehouseMap.get(row.warehouseId)?.warehouseName }}</div>
            </template>
          </el-table-column>
        </template>
        <el-table-column label="库位编号">
          <template #default="{ row }">
            <div>{{ row.stockCode || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="库存" prop="quantity" align="center">
          <template #default="{ row }">
            <el-statistic :value="Number(row.quantity)" :precision="0"/>
          </template>
        </el-table-column>
      </el-table>

      <el-row>
        <pagination v-show="total>0" :total="total" v-model:page="queryParams.pageNum"
                    v-model:limit="queryParams.pageSize" @pagination="getList"/>
      </el-row>
    </el-card>
  </div>
</template>

<script setup name="Inventory">
import {
  listInventoryBoard
} from '@/api/wms/inventory';
import {computed, getCurrentInstance, onMounted, ref} from 'vue';
import {ElForm} from 'element-plus';
import {getRowspanMethod} from "@/utils/getRowSpanMethod";
import {useWmsStore} from '@/store/modules/wms'
import * as XLSX from 'xlsx'
import {saveAs} from 'file-saver'

const {proxy} = getCurrentInstance();
const { product_level } = proxy.useDict('product_level');
const spanMethod = computed(() => getRowspanMethod(inventoryList.value, rowSpanArray.value))

const inventoryList = ref([]);
const buttonLoading = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const rowSpanArray = ref(['warehouseId', 'itemId', 'warehouseIdAndItemId'])

const filterable = ref(false)
const queryType = ref("warehouse")
const queryParams = ref({
  pageNum: 1,
  pageSize: 10,
  skuId: undefined,
  warehouseId: undefined,
  itemName: undefined,
  itemCode: undefined,
  unit: undefined,
  itemCategory: undefined,
  skuName: undefined,
  skuCode: undefined,
  minQuantity: undefined
})

/** 查询库存列表 */
const getList = async () => {
  let query = {...queryParams.value}
  if (filterable.value) {
    query.minQuantity = 1
  } else {
    query.minQuantity = undefined
  }
  loading.value = true;
  const res = await listInventoryBoard(query,queryType.value);
  inventoryList.value = res.rows;
  inventoryList.value.forEach(it => {
    if (queryType.value == "warehouse") {
      it.itemId = it.item.id
      it.warehouseIdAndItemId = it.warehouseId + '-' + it.item.id
    } else if (queryType.value == "item") {
      it.itemId = it.item.id
      it.skuIdAndWarehouseId = it.skuId + '-' + it.warehouseId
    }
  })
  total.value = res.total;
  loading.value = false;
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
const resetQuery = () => {
  proxy.resetForm("queryRef");
  handleQuery();
}
const calcSubtotal = (row) => {
  const tempList = inventoryList.value.filter(it => it.itemId === row.itemId)
  let sum = 0
  tempList.forEach(it => {
    sum += Number(it.quantity)
  })
  return sum
}

const handleSortTypeChange = (e) => {
  if (e === "warehouse") {
    rowSpanArray.value = ['warehouseId', 'itemId']
  }  else if (e === "item") {
    rowSpanArray.value = ['itemId', 'skuId','skuIdAndWarehouseId']
  }
  queryParams.value.pageNum = 1;
  getList()
}

const handleChangeFilterZero = (e) => {
  queryParams.value.pageNum = 1;
  getList()
}

/** 导出库存统计 */
const exportLoading = ref(false);
const handleExport = async () => {
  exportLoading.value = true;
  try {
    // 获取全量数据（不分页）
    let query = { ...queryParams.value, pageNum: 1, pageSize: 99999 };
    if (filterable.value) {
      query.minQuantity = 1;
    }
    const res = await listInventoryBoard(query, queryType.value);
    const rows = res.rows || [];

    if (rows.length === 0) {
      proxy?.$modal.msgWarning('没有可导出的数据');
      return;
    }

    const store = useWmsStore();
    // 查找字典 label
    const getLevelLabel = (val) => {
      const dict = product_level.value?.find(d => d.value === String(val));
      return dict ? dict.label : (val || '');
    };

    // 构建导出数据
    const exportData = rows.map(row => ({
      '仓库': store.warehouseMap.get(row.warehouseId)?.warehouseName || '',
      '商品名称': row.item?.itemName || '',
      '商品编号': row.item?.itemCode || '',
      '商品单位': row.item?.unit ? (store.merchantMap.get(row.item.unit)?.merchantName || '') : '',
      '商品分类': row.item?.itemCategory ? (store.itemCategoryMap.get(row.item.itemCategory)?.categoryName || '') : '',
      '商品级别': getLevelLabel(row.item?.itemLevel),
      '规格名称': row.itemSku?.skuName || '',
      '规格编号': row.itemSku?.skuCode || '',
      '库位编号': row.stockCode || '-',
      '库存': Number(row.quantity) || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    // 设置列宽
    ws['!cols'] = [
      { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
      { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 16 },
      { wch: 14 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = queryType.value === 'warehouse' ? '仓库维度库存统计' : '商品维度库存统计';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${sheetName}_${new Date().getTime()}.xlsx`);
  } catch (e) {
    proxy?.$modal.msgError('导出失败：' + (e.message || e));
  } finally {
    exportLoading.value = false;
  }
}

onMounted(() => {
  useWmsStore().getMerchantList();
  useWmsStore().getItemCategoryList();
  getList();
});
</script>
<style>
.el-statistic__content {
  font-size: 14px;
}
.el-table .vertical-top-cell {
  vertical-align: top
}
</style>
