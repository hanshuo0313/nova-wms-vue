<template>
  <div v-if="!checking" style="display: flex;justify-content: center;align-items: center;height: 80vh">
    <el-card header="选择仓库后开始盘库" >
      <el-form>
        <el-form-item label="仓库" prop="warehouseId">
          <el-select v-model="form.warehouseId" placeholder="请选择仓库" :disabled="checking"
                     filterable>
            <el-option v-for="item in useWmsStore().warehouseList" :key="item.id" :label="item.warehouseName"
                       :value="item.id"/>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" plain="plain" size="default" @click="startCheck"  style="width: 100%!important;">开始盘库</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  <div v-else v-loading="loading">
    <div class="receipt-order-edit-wrapper app-container" style="margin-bottom: 60px">
      <el-card header="盘库单基本信息">
        <el-form label-width="108px" :model="form" ref="checkForm" :rules="rules">
          <el-row :gutter="24">
            <el-col :span="11">
              <el-form-item label="盘库单号" prop="orderNo">
                <el-input class="w200" v-model="form.orderNo" placeholder="盘库单号"
                          :disabled="form.id"></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="仓库" prop="warehouseId">
                <el-select v-model="form.warehouseId" placeholder="请选择仓库" :disabled="checking"
                           filterable>
                  <el-option v-for="item in useWmsStore().warehouseList" :key="item.id" :label="item.warehouseName"
                             :value="item.id"/>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="11">
              <el-form-item label="备注" prop="remark">
                <el-input
                  v-model="form.remark"
                  placeholder="备注...100个字符以内"
                  rows="4"
                  maxlength="100"
                  type="textarea"
                  show-word-limit="show-word-limit"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="盈亏数" prop="totalQuantity">
                <el-input-number v-model="form.totalQuantity" :controls="false" :precision="0"
                                 :disabled="true"></el-input-number>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>
      <el-card header="商品明细" class="mt10">
        <div class="receipt-order-content">
          <div class="flex-space-between mb8">
            <div>
              <el-button type="primary" plain="plain" size="default" @click="showInventorySelect" icon="Plus"
                         :disabled="!form.warehouseId">指定商品盘点
              </el-button>
              <el-button type="success" plain="plain" size="default" @click="showSkuSelect" icon="Plus"
                         :disabled="!form.warehouseId">新增商品
              </el-button>
            </div>
          </div>
          <el-table :data="form.details" border empty-text="暂无商品明细">
            <el-table-column label="商品名称" min-width="120" show-overflow-tooltip>
              <template #default="scope">
                {{ scope.row.item.itemName }}
              </template>
            </el-table-column>
            <el-table-column label="商品编号" align="center" min-width="110" show-overflow-tooltip>
              <template #default="scope">
                {{ scope.row.item.itemCode }}
              </template>
            </el-table-column>
            <el-table-column label="规格信息">
              <template #default="{ row }">
                <template v-if="row.newInventoryDetail">
                  <div v-if="row.itemSku">{{ row.itemSku.skuName + (row.itemSku.barcode ? ('(' + row.itemSku.barcode + ')') : '') }}</div>
                  <div v-else>请选择商品</div>
                </template>
                <template v-else>
                  <div>{{ row.itemSku.skuName + (row.itemSku.skuCode ? ('(' + row.itemSku.skuCode + ')') : '') }}</div>
                </template>
              </template>
            </el-table-column>
            <el-table-column label="库位编号" prop="stockCode" width="300">
              <template #default="scope">
                <div class="location-tags-wrapper">
                  <el-tag
                    v-for="(code, index) in parseLocationCodes(scope.row.stockCode)"
                    :key="index"
                    closable
                    type="info"
                    class="location-tag"
                    @close="handleRemoveLocation(scope.row, index)"
                  >
                    {{ code }}
                  </el-tag>
                    <el-select
                      placeholder="添加库位"
                      size="small"                    style="width: 140px"
                      filterable
                      clearable
                      :loading="locationLoading"
                      v-model="scope.row._tempLocationSelect"
                      @change="handleAddLocation(scope.row, $event)"
                    >
                      <el-option
                        v-for="item in getLocationList(scope.row)"
                        :key="item"
                        :label="item"
                        :value="item"
                      />
                    </el-select>
                  <el-button
                    v-if="scope.row._originalStockCode && scope.row.stockCode !== scope.row._originalStockCode"
                    link
                    type="primary"
                    size="small"
                    @click="handleRestoreLocation(scope.row)"
                    class="restore-btn"
                  >
                    恢复
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="账面库存" align="right" width="150">
              <template #default="{ row }">
                <el-statistic :value="Number(row.quantity)" :precision="0"/>
              </template>
            </el-table-column>
            <el-table-column label="盈亏数" prop="remainQuantity" align="right" width="150">
              <template #default="{ row }">
                <el-statistic :value="Number(row.checkQuantity) - Number(row.quantity)" :precision="0"/>
              </template>
            </el-table-column>
            <el-table-column label="实际库存" prop="checkQuantity" width="180">
              <template #default="scope">
                <el-input-number
                  v-model="scope.row.checkQuantity"
                  placeholder="实际库存"
                  :min="0"
                  :precision="0"
                  @change="handleChangeQuantity"
                ></el-input-number>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="scope">
                <el-button icon="Delete" type="danger" plain size="small"
                           @click="handleDeleteDetail(scope.row, scope.$index)" link>删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
      <InventorySelect
        ref="inventorySelectRef"
        :model-value="inventorySelectShow"
        @handleOkClick="handleInventorySelectOkClick"
        @handleCancelClick="inventorySelectShow = false"
        :size="'75%'"
        :warehouse-id="form.warehouseId"
        :selected-inventory="selectedInventory"
      />
      <SkuSelect
        ref="skuSelectRef"
        :model-value="skuSelectShow"
        :selected-sku="selectedSku"
        @handleOkClick="handleOkClick"
        @handleCancelClick="skuSelectShow = false"
        :size="'80%'"
      />
    </div>
    <div class="footer-global" v-if="checking">
      <div class="btn-box">
        <div>
          <el-button @click="doCheck" type="primary" class="ml10">完成盘库</el-button>
          <el-button @click="updateToInvalid" type="danger" v-if="form.id">作废</el-button>
          <el-button @click="save" type="primary">暂存</el-button>
          <el-button @click="cancel" class="mr10">取消</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup name="CheckOrderEdit">
import {computed, getCurrentInstance, onMounted, reactive, ref, toRef, toRefs, watch} from "vue";
const skuSelectRef = ref(null)
const inventorySelectRef = ref(null)
import {addCheckOrder, getCheckOrder, updateCheckOrder, check} from "@/api/wms/checkOrder";
import {delCheckOrderDetail} from "@/api/wms/checkOrderDetail";
import {listInventoryNoPage} from "@/api/wms/inventory";
import {ElMessage, ElMessageBox} from "element-plus";
import {useRoute} from "vue-router";
import {useWmsStore} from '@/store/modules/wms'
import {numSub, generateNo} from '@/utils/ruoyi'
import SkuSelect from "@/views/components/SkuSelect.vue";
import {listLocation} from "@/api/wms/location";
import InventorySelect from "@/views/components/InventorySelect.vue";  // 新增这一行
import {getWarehouseAndSkuKey} from "@/utils/wmsUtil";

const selectedInventory = ref([])
const filterZeroInventory = ref(false)


const {proxy} = getCurrentInstance();
const {wms_shipment_type} = proxy.useDict("wms_shipment_type");
const loading = ref(false)
const selectedSku = ref([])
// 库位列表缓存（按仓库ID分组）
const locationListCache = ref({})
// 当前显示的库位列表
const currentLocationList = ref([])
// 库位加载状态
const locationLoading = ref(false)
const initFormData = {
  id: undefined,
  orderNo: undefined,
  orderStatus: 0,
  remark: undefined,
  warehouseId: undefined,
  totalQuantity: 0,
  details: [],
}
const data = reactive({
  form: {...initFormData},
  rules: {
    orderNo: [
      {required: true, message: "盘库单号不能为空", trigger: "blur"}
    ],
    warehouseId: [
      {required: true, message: "请选择仓库", trigger: ['blur', 'change']}
    ],
  }
});
const {form, rules} = toRefs(data);
const cancel = async () => {
  await proxy?.$modal.confirm('确认取消编辑盘库单吗？');
  close()
}
const close = () => {
  const obj = {path: "/checkOrder"};
  proxy?.$tab.closeOpenPage(obj);
}
const inventorySelectShow = ref(false)
const skuSelectShow = ref(false)
// 盘库中标识
const checking = ref(false)

// 选择商品 start
const startCheck = () => {
  if (!form.value.warehouseId) {
    return ElMessage.error('请先选择仓库！')
  }
  checking.value = true  // 只切换状态，进入编辑界面
}
// 选择成功(新增商品)
const handleOkClick = (item) => {
  skuSelectShow.value = false
  selectedSku.value = [...item]
  item.forEach(it => {
    if (!form.value.details.find(detail => detail.itemSku.id === it.id)) {
      form.value.details.push(
        {
          itemSku: it.itemSku,
          item: it.item,
          skuId: it.id,
          warehouseId: form.value.warehouseId,
          inventoryId: null,
          quantity: 0,
          checkQuantity: 0,
          newInventory: true
          /*inventoryId: it.inventoryId || null,
          quantity: Number(it.quantity || 0),
          checkQuantity: Number(it.quantity || 0),
          newInventory: !it.inventoryId,
          stockCode: it.stockCode || '',
          _originalStockCode: it.stockCode || '',
          _tempLocationSelect: ''*/
        })
    }
  })
}

const showSkuSelect = () => {
  skuSelectRef.value.getList()
  skuSelectShow.value = true
}

// 显示库存选择弹窗（指定商品盘点）
const showInventorySelect = () => {
  inventorySelectRef.value.setWarehouseId(form.value.warehouseId)
  inventorySelectRef.value.getList()
  inventorySelectShow.value = true
}

// 选择成功（从库存中选择 - 指定商品盘点）
const handleInventorySelectOkClick = (item) => {
  inventorySelectShow.value = false
  selectedInventory.value = [...item]
  item.forEach(it => {
    if (!form.value.details.find(detail => getWarehouseAndSkuKey(detail) === getWarehouseAndSkuKey(it))) {
      form.value.details.push(
        {
          itemSku: it.itemSku,
          item: it.item,
          skuId: it.skuId,
          warehouseId: form.value.warehouseId,
          inventoryId: it.id,
          quantity: Number(it.quantity),
          checkQuantity: Number(it.quantity),
          newInventory: false,
          stockCode: it.stockCode || '',
          _originalStockCode: it.stockCode || '',
          _tempLocationSelect: ''
        })
    }
  })
  handleChangeQuantity()
}


// 初始化receipt-order-form ref
const checkForm = ref()

const save = async () => {
  await proxy?.$modal.confirm('确认暂存盘库单吗？');
  doSave()
}
const getParams = (orderStatus) => {
  let details = []
  if (form.value.details?.length) {
    // 构建参数
    details = form.value.details.map(it => {
      return {
        id: it.id,
        orderId: form.value.id,
        skuId: it.skuId,
        quantity: it.quantity,
        checkQuantity: it.checkQuantity,
        inventoryId: it.inventoryId,
        warehouseId: form.value.warehouseId,
        stockCode: it.stockCode || undefined,
      }
    })
  }
  return  {
    id: form.value.id,
    orderNo: form.value.orderNo,
    orderStatus,
    remark: form.value.remark,
    totalQuantity: form.value.totalQuantity,
    warehouseId: form.value.warehouseId,
    details: details
  }
}
const doSave = (orderStatus = 0) => {
  //验证shipmentForm表单
  checkForm.value?.validate((valid) => {
    // 校验
    if (!valid) {
      return ElMessage.error('请填写必填项')
    }
    const params = getParams(orderStatus);
    loading.value = true
    if (params.id) {
      updateCheckOrder(params).then((res) => {
        if (res.code === 200) {
          ElMessage.success(res.msg)
          close()
        } else {
          ElMessage.error(res.msg)
        }
      }).finally(() => {
        loading.value = false
      })
    } else {
      addCheckOrder(params).then((res) => {
        if (res.code === 200) {
          ElMessage.success(res.msg)
          close()
        } else {
          ElMessage.error(res.msg)
        }
      }).finally(() => {
        loading.value = false
      })
    }
  })
}


const updateToInvalid = async () => {
  await proxy?.$modal.confirm('确认作废盘库单吗？');
  doSave(-1)
}

const doCheck = async () => {
  await proxy?.$modal.confirm('确认盘库结束吗？');
  checkForm.value?.validate((valid) => {
    // 校验
    if (!valid) {
      return ElMessage.error('请填写必填项')
    }
    const invalidLocationList = form.value.details.filter(it => !it.stockCode)
    if (invalidLocationList?.length) {
      return ElMessage.error('请选择库位')
    }
    loading.value = true
    const params = getParams(1);
    check(params).then((res) => {
      if (res.code === 200) {
        ElMessage.success('盘库成功')
        close()
      } else {
        ElMessage.error(res.msg)
      }
    }).finally(() => {
      loading.value = false
    })
  })
}

const route = useRoute();
onMounted(() => {
  const id = route.query && route.query.id;
  if (id) {
    checking.value = true
    loadDetail(id)
  } else {
    form.value.orderNo = 'PK' + generateNo()
  }
})


// 获取入库单详情
const loadDetail = (id) => {
  loading.value = true
  getCheckOrder(id).then((response) => {
    if (response.data.details?.length) {
      response.data.details.forEach(detail => {
        detail.newInventory = !detail.inventoryId
        detail._originalStockCode = detail.stockCode || ''  // 新增这一行
        detail._tempLocationSelect = ''  // 新增这一行
      })
      // 初始化两个选中列表
      selectedInventory.value = response.data.details
        .filter(it => it.inventoryId)
        .map(it => ({
          id: it.inventoryId,
          skuId: it.skuId,
          warehouseId: it.warehouseId
        }))
      selectedSku.value = response.data.details.map(it => ({
        id: it.skuId
      }))
    }
    form.value = {...response.data}
    Promise.resolve();
  }).then(() => {
  }).finally(() => {
    loading.value = false
  })
}


const handleDeleteDetail = (row, index) => {
  if (row.id) {
    proxy.$modal.confirm('确认删除本条商品明细吗？如确认会立即执行！').then(function () {
      return delCheckOrderDetail(row.id);
    }).then(() => {
      form.value.details.splice(index, 1)
      proxy.$modal.msgSuccess("删除成功");
    })
  } else {
    form.value.details.splice(index, 1)
  }
  // 同时从两个选中列表中移除
  const indexOfInventory = selectedInventory.value.findIndex(it => getWarehouseAndSkuKey(it) === getWarehouseAndSkuKey(row))
  if (indexOfInventory !== -1) {
    selectedInventory.value.splice(indexOfInventory, 1)
  }
  const indexOfSku = selectedSku.value.findIndex(it => it.id === row.itemSku.id)
  if (indexOfSku !== -1) {
    selectedSku.value.splice(indexOfSku, 1)
  }
}


const handleChangeQuantity = () => {
  let totalQuantity = 0
  form.value.details.forEach(it => {
    if (it.quantity !== it.checkQuantity) {
      totalQuantity += (it.checkQuantity - it.quantity)
    }
  })
  form.value.totalQuantity = totalQuantity
}


// 解析库位编码字符串为数组
const parseLocationCodes = (stockCode) => {
  if (!stockCode) {
    return []
  }
  return stockCode.split(',').filter(code => code.trim())
}

// 处理移除库位标签
const handleRemoveLocation = (row, index) => {
  const codes = parseLocationCodes(row.stockCode)
  codes.splice(index, 1)

  if (codes.length === 0) {
    row.stockCode = ''
    ElMessage.warning('请至少保留一个库位')
  } else {
    row.stockCode = codes.join(',')
  }
}

// 处理添加库位
const handleAddLocation = (row, locationCode) => {
  if (!locationCode) {
    return
  }

  const codes = parseLocationCodes(row.stockCode || '')

  // 检查是否已存在
  if (codes.includes(locationCode)) {
    ElMessage.warning('该库位已添加')
    row._tempLocationSelect = ''
    return
  }

  codes.push(locationCode)
  row.stockCode = codes.join(',')
  row._tempLocationSelect = ''
}


// 处理一键恢复原始值
const handleRestoreLocation = (row) => {
  row.stockCode = row._originalStockCode
  row._showLocationSelect = false
  ElMessage.success('已恢复原始库位')
}


// 获取指定仓库的库位列表
const fetchLocationList = async (warehouseId) => {
  if (!warehouseId) {
    currentLocationList.value = []
    return
  }

  // 如果已经缓存过，直接返回
  if (locationListCache.value[warehouseId]) {
    currentLocationList.value = locationListCache.value[warehouseId]
    return
  }

  try {
    locationLoading.value = true
    const response = await listLocation({
      warehouseId: warehouseId,
      pageNum: 1,
      pageSize: 9999
    })

    // 提取库位编号并缓存
    const locations = (response.rows || []).map(item => item.stockCode).filter(code => code)
    locationListCache.value[warehouseId] = locations
    currentLocationList.value = locations
  } catch (error) {
    console.error('获取库位列表失败:', error)
    currentLocationList.value = []
  } finally {
    locationLoading.value = false
  }
}

// 监听仓库变化，自动加载库位列表
watch(() => form.value.warehouseId, (newWarehouseId) => {
  if (newWarehouseId) {
    fetchLocationList(newWarehouseId)
  } else {
    currentLocationList.value = []
  }
}, { immediate: true })

const getLocationList = (row) => {
  // 解析当前行的库位编码
  const currentCodes = parseLocationCodes(row.stockCode || '')

  // 合并API返回的库位和已使用的库位
  const existingLocations = form.value.details
    .filter(item => item.stockCode && item !== row)
    .map(item => parseLocationCodes(item.stockCode))
    .flat()

  // 合并并去重，排除当前行已有的库位
  const allLocations = [...new Set([...currentLocationList.value, ...existingLocations])]
    .filter(loc => !currentCodes.includes(loc))

  return allLocations.sort()
}

</script>

<style lang="scss" scoped>
@import "@/assets/styles/variables.module";

.btn-box {
  width: calc(100% - #{$base-sidebar-width});
  display: flex;
  align-items: center;
  justify-content: flex-end;
  float: right;
}

.el-statistic__content {
  font-size: 14px;
}

.location-tags-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-height: 32px;

  .location-tag {
    margin: 2px;
    font-size: 14px;
  }

  .restore-btn {
    margin-left: 4px;
    font-size: 14px;
  }

  :deep(.el-select) {
    .el-input__wrapper {
      box-shadow: none;
      border: 1px dashed #dcdfe6;

      &:hover {
        border-color: #409eff;
      }
    }
  }
}
</style>
