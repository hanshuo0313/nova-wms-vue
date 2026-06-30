<template>
  <el-drawer :model-value="show" title="商品选择" @close="handleCancelClick" :size="size" :close-on-click-modal="false" append-to-body>
    <el-form :inline="true" label-width="68px">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="商品名称">
            <el-input v-model="query.itemName" clearable placeholder="商品名称"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="商品编号">
            <el-input class="w200" v-model="query.itemCode" clearable placeholder="商品编号"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="规格名称">
            <el-input class="w200" v-model="query.skuName" clearable placeholder="规格名称"></el-input>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="规格编号">
            <el-input class="w200" v-model="query.barcode" clearable placeholder="规格编号"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="供应商">
            <el-select v-model="query.unit" clearable filterable placeholder="请选择单位" style="width: 90%">
              <el-option v-for="item in useWmsStore().merchantList" :key="item.id" :label="item.merchantName" :value="item.id"/>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="商品分类">
            <el-select v-model="query.itemCategory" clearable filterable placeholder="请选择分类" style="width: 90%">
              <el-option v-for="item in useWmsStore().itemCategoryList" :key="item.id" :label="item.categoryName" :value="item.id"/>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="24" style="text-align: right">
          <el-button type="primary" @click="loadAll">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-col>
      </el-row>
    </el-form>
    <el-table :data="list" @selection-change="handleSelectionChange" border :row-key="getRowKey" empty-text="暂无商品" v-loading="loading" ref="skuSelectFormRef" cell-class-name="my-cell">
      <el-table-column type="selection" width="55" :reserve-selection="true" v-if="!singleSelect" :selectable="judgeSelectable"/>
      <el-table-column label="商品名称" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.item.itemName }}
        </template>
      </el-table-column>
      <el-table-column label="商品编号" align="center" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.item.itemCode }}
        </template>
      </el-table-column>
      <el-table-column label="供应商" align="center" min-width="90" show-overflow-tooltip>
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
      <el-table-column label="规格信息">
        <template #default="{ row }">
          <div>{{ row.itemSku.skuName }}</div>
          <div v-if="row.itemSku.skuCode">编号：{{ row.itemSku.skuCode }}</div>
<!--          <div v-if="row.itemSku.barcode">条码：{{ row.itemSku.barcode }}</div>-->
        </template>
      </el-table-column>
      <el-table-column label="价格(元)" width="160" align="left">
        <template #default="{ row }">
          <div v-if="row.itemSku.costPrice" class="flex-space-between">
            <span>成本价：</span>
            <div>{{ (row.itemSku.costPrice || row.itemSku.costPrice === 0) ? row.itemSku.costPrice : '' }}</div>
          </div>
          <div v-if="row.itemSku.sellingPrice" class="flex-space-between">
            <span>销售价：</span>
            <div>{{ (row.itemSku.sellingPrice || row.itemSku.sellingPrice === 0) ? row.itemSku.sellingPrice : '' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="重量(kg)" width="120" align="left">
        <template #default="{ row }">
          <div v-if="row.itemSku.netWeight" class="flex-space-between">
            <span>净重：</span>
            <div>{{ (row.itemSku.netWeight || row.itemSku.netWeight === 0) ? row.itemSku.netWeight : '' }}</div>
          </div>
          <div v-if="row.itemSku.grossWeight" class="flex-space-between">
            <span>毛重：</span>
            <div>{{ (row.itemSku.grossWeight || row.itemSku.grossWeight === 0) ? row.itemSku.grossWeight : '' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="长宽高(cm)" align="right" width="120">
        <template #default="{ row }">
          <div>{{ getVolumeText(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" v-if="singleSelect" align="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleChooseSku(row)">选择</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-row>
      <pagination v-show="total > 0" :total="total" :page-sizes="[5, 10, 20, 50]" v-model:limit="pageReq.size" v-model:page="pageReq.page"
                  @pagination="getList" class="mr10"/>
    </el-row>
    <template v-slot:footer>
      <div style="width: 100%;display: flex;justify-content: space-between">
        <span>
          <el-button @click="loadAll" icon="Refresh">刷新</el-button>
        </span>
        <span>
          <el-button @click="handleCancelClick">取消</el-button>
          <el-button type="primary" @click="handleOkClick" v-if="!singleSelect">确认</el-button>
      </span>
      </div>
    </template>
  </el-drawer>
</template>
<script setup lang="ts" name="SkuSelect">
import {computed, getCurrentInstance, onMounted, reactive, ref} from 'vue';
import {listItemSkuPage} from "@/api/wms/itemSku";
import {useWmsStore} from '@/store/modules/wms'

const { proxy } = getCurrentInstance()
const { product_level } = proxy.useDict('product_level');

const loading = ref(false)
const query = reactive({
  itemName: '',
  itemCode: '',
  skuName: '',
  barcode: '',
  unit: '',
  itemCategory: ''
});
const selectItemSkuVoCheck = ref([])
const skuSelectFormRef = ref(null)
const total = ref(0);
const pageReq = reactive({
  page: 1,
  size: 10,
});
const list = ref([]);
const rightList = ref([]);
const rightListKeySet = computed(() => {
  const set = new Set();
  rightList.value.forEach((it) => set.add(it.id));
  return set
});

const loadAll = () => {
  pageReq.page = 1
  getList()
};

const handleReset = () => {
  query.itemName = ''
  query.itemCode = ''
  query.skuName = ''
  query.barcode = ''
  query.unit = ''
  query.itemCategory = ''
  loadAll()
};
const getRowKey = (row: any) => {
  return row.id;
}
const getList = () => {
  const data = {
    ...query,
    pageNum: pageReq.page,
    pageSize: pageReq.size
  }
  loading.value = true
  listItemSkuPage(data).then((res) => {
    const content = [...res.rows];
    list.value = content.map((it) => ({...it, id: it.skuId, checked: false}));
    total.value = res.total;
  }).then(() => toggleSelection()).finally(() => loading.value = false);
}

// 定义props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: '30%'
  },
  singleSelect:{
    type: Boolean,
    default: false
  },
  selectedSku: {
    type: Array,
    default: []
  }
})

const show = computed(() => {
  return props.modelValue;
})

// 定义事件
const emit = defineEmits<{
  (e: 'handleCancelClick')
  (e: 'handleOkClick', value)
  (e: 'handleSingleOkClick', value)
}>()

function handleCancelClick() {
  emit('handleCancelClick');
  clearQuantity()
}

function handleChooseSku(row) {
  emit('handleSingleOkClick', row);
}

function handleOkClick() {
  emit('handleOkClick', selectItemSkuVoCheck.value);
  clearQuantity()
}
/** 多选框选中数据 */
const handleSelectionChange = (selection) => {
  selectItemSkuVoCheck.value = selection
}

const toggleSelection = () => {
  props.selectedSku.forEach(selected => {
    const index = list.value.findIndex(it => selected.id=== it.id)
    if (index !== -1) {
      skuSelectFormRef.value.toggleRowSelection(list.value[index], true)
    }
  })
}

const judgeSelectable = (row) => {
  if (props.selectedSku.find(selected => selected.id === row.id)) {
    return false;
  }
  return true
}


function clearQuantity() {
  skuSelectFormRef.value.clearSelection()
}

const getVolumeText = (row) => {
  const sku = row.itemSku || {}
  if((sku.length || sku.length === 0) && (sku.width || sku.width === 0) && (sku.height || sku.height === 0)) {
    return sku.length + ' * ' + sku.width + ' * ' + sku.height
  }
  return ((sku.length || sku.length === 0) ? ('长：' + sku.length) : '')
    + ((sku.width || sku.width === 0) ? (' 宽：' + sku.width) : '')
    + ((sku.height || sku.height === 0) ? (' 高：' + sku.height) : '')
}
defineExpose({
  getList
})

onMounted(() => {
  useWmsStore().getMerchantList();
  useWmsStore().getItemCategoryList();
});
</script>
<style lang="scss">
.el-table .my-cell {
  vertical-align: top
}

.flex-center {
  display: flex;
  align-items: center;
}

.mr5 {
  margin-right: 5px;
}

.mt5 {
  margin-top: 5px;
}

.add-btn {
  width: 100%;
}
</style>
