<template>
  <div>
    <div class="receipt-order-edit-wrapper app-container" style="margin-bottom: 60px" v-loading="loading">
      <el-card header="移库单基本信息">
        <el-form label-width="108px" :model="form" ref="movementForm" :rules="rules">
          <el-row :gutter="24">
            <el-col :span="11">
              <el-form-item label="移库单号" prop="orderNo">
                <el-input class="w200" v-model="form.orderNo" placeholder="移库单号"
                          :disabled="form.id"></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="源仓库" prop="sourceWarehouseId">
                <el-select v-model="form.sourceWarehouseId" placeholder="请选择源仓库" @change="handleChangeSourceWarehouse"
                           filterable>
                  <el-option v-for="item in useWmsStore().warehouseList" :key="item.id" :label="item.warehouseName"
                             :value="item.id"/>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="目标仓库" prop="targetWarehouseId">
                <el-select v-model="form.targetWarehouseId" placeholder="请选择目标仓库" @change="handleChangeTargetWarehouse"
                           filterable style="width: 100%">
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
              <div style="display: flex;align-items: start">
                <el-form-item label="总金额" prop="totalAmount">
                  <el-input-number style="width: 100%;" v-model="form.totalAmount" :precision="2" :min="0"></el-input-number>
                </el-form-item>
                <el-button link type="primary" @click="handleAutoCalc" style="line-height: 32px">自动计算
                </el-button>
              </div>
            </el-col>
            <el-col :span="6">
              <el-form-item label="总数量" prop="totalQuantity" >
                <el-input-number v-model="form.totalQuantity" :controls="false" :precision="0"
                                 :disabled="true" style="width: 100%"></el-input-number>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>
      <el-card header="商品明细" class="mt10">
        <div class="receipt-order-content">
          <div class="flex-space-between mb8">
<!--            <div>
              <span>审批 | 一物一码：</span>
              <el-switch
                class="mr10 ml10"
                inline-prompt
                size="large"
                v-model="mode"
                :active-value="true"
                :inactive-value="false"
                active-text="开启"
                inactive-text="关闭"
              />
            </div>-->
            <el-popover
              placement="left"
              title="提示"
              :width="200"
              trigger="hover"
              :disabled="!!(form.sourceWarehouseId && form.targetWarehouseId)"
              content="请先选择源仓库和目标仓库！"
            >
              <template #reference>
                <el-button type="primary" plain="plain" size="default" @click="showAddItem" icon="Plus"
                           :disabled="!form.sourceWarehouseId || !form.targetWarehouseId">添加商品
                </el-button>
              </template>
            </el-popover>
          </div>
          <el-table :data="form.details" border empty-text="暂无商品明细">
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
            <el-table-column label="规格信息">
              <template #default="{ row }">
                <div>{{ row.itemSku.skuName}}</div>
                <div v-if="row.itemSku.skuCode">编码：{{ row.itemSku.skuCode }}</div>
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
                  <!--                  <el-select
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
                                    </el-select>-->
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
            <el-table-column label="移库数量" prop="quantity" width="180" align="center">
              <template #default="scope">
                <el-input-number
                  v-model="scope.row.quantity"
                  placeholder="移库数量"
                  :min="1"
                  :precision="0"
                  @change="handleChangeQuantity"
                ></el-input-number>
              </template>
            </el-table-column>
            <el-table-column label="金额" prop="amount" width="180" align="center">
              <template #default="scope">
                <el-input-number
                  v-model="scope.row.amount"
                  placeholder="金额"
                  :precision="2"
                  :min="0"
                  :max="2147483647"
                ></el-input-number>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="right" fixed="right">
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
        @handleOkClick="handleOkClick"
        @handleCancelClick="inventorySelectShow = false"
        :size="'75%'"
        :select-warehouse-disable="false"
        :warehouse-id="form.sourceWarehouseId"
        :selected-inventory="selectedInventory"
      />
    </div>
    <div class="footer-global">
      <div class="btn-box">
        <div>
          <el-button @click="doMovement" type="primary" class="ml10">完成移库</el-button>
          <el-button @click="updateToInvalid" type="danger" v-if="form.id">作废</el-button>
        </div>
        <div>
          <el-button @click="save" type="primary">暂存</el-button>
          <el-button @click="cancel" class="mr10">取消</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup name="MovementOrderEdit">
import {computed, getCurrentInstance, onMounted, reactive, ref, toRef, toRefs, watch} from "vue";
import {addMovementOrder, getMovementOrder, updateMovementOrder, movement} from "@/api/wms/movementOrder";
import {delMovementOrderDetail} from "@/api/wms/movementOrderDetail";
import {ElMessage, ElMessageBox} from "element-plus";
import {useRoute} from "vue-router";
import {useWmsStore} from '@/store/modules/wms'
import {numSub, generateNo} from '@/utils/ruoyi'
import InventorySelect from "@/views/components/InventorySelect.vue";
import {getSourceWarehouseAndSkuKey, getWarehouseAndSkuKey} from "@/utils/wmsUtil";
import {listLocation} from "@/api/wms/location";

const {proxy} = getCurrentInstance();
const {wms_shipment_type} = proxy.useDict("wms_shipment_type");

const loading = ref(false)
// 库位列表缓存（按仓库ID分组）
const locationListCache = ref({})
// 当前显示的库位列表
const currentLocationList = ref([])
// 库位加载状态
const locationLoading = ref(false)
const initFormData = {
  id: undefined,
  orderNo: undefined,
  shipmentOrderStatus: 0,
  remark: undefined,
  totalAmount: undefined,
  sourceWarehouseId: undefined,
  targetWarehouseId: undefined,
  totalQuantity: 0,
  details: [],
}
const inventorySelectRef = ref(null)
const selectedInventory = ref([])
const data = reactive({
  form: {...initFormData},
  rules: {
    orderNo: [
      {required: true, message: "出库单号不能为空", trigger: "blur"}
    ],
    sourceWarehouseId: [
      {required: true, message: "请选择源仓库", trigger: ['blur', 'change']}
    ],
    targetWarehouseId: [
      {required: true, message: "请选择目标仓库", trigger: ['blur', 'change']}
    ],
  }
});
const {form, rules} = toRefs(data);
const cancel = async () => {
  await proxy?.$modal.confirm('确认取消编辑移库单吗？');
  close()
}
const close = () => {
  const obj = {path: "/movementOrder"};
  proxy?.$tab.closeOpenPage(obj);
}
const inventorySelectShow = ref(false)

// 选择商品 start
const showAddItem = () => {
  inventorySelectRef.value.getList()
  inventorySelectShow.value = true
}
// 选择成功
const handleOkClick = (item) => {
  inventorySelectShow.value = false
  selectedInventory.value = [...item]
  item.forEach(it => {
    if (!form.value.details.find(detail => getSourceWarehouseAndSkuKey(detail) === getWarehouseAndSkuKey(it))) {
      form.value.details.push(
        {
          itemSku: it.itemSku,
          item: it.item,
          skuId: it.skuId,
          quantity: undefined,
          amount: undefined,
          sourceWarehouseId: form.value.sourceWarehouseId,
          stockCode: it.stockCode || '',
          _originalStockCode: it.stockCode || '',
          _tempLocationSelect: ''
        })
    }
  })
}
// 选择商品 end

// 初始化receipt-order-form ref
const movementForm = ref()

const handleAutoCalc = () => {
  let sum = undefined
  form.value.details.forEach(it => {
    if (it.amount >= 0) {
      if (!sum) {
        sum = 0
      }
      sum = numSub(sum, -Number(it.amount))
    }
  })
  form.value.totalAmount = sum
}

const save = async () => {
  await proxy?.$modal.confirm('确认暂存移库单吗？');
  doSave()
}
const getParams = (orderStatus) => {
  let details = []
  if (form.value.details?.length) {
    // 构建参数
    details = form.value.details.map(it => {
      return {
        id: it.id,
        movementOrderId: form.value.id,
        skuId: it.skuId,
        quantity: it.quantity,
        amount: it.amount,
        sourceWarehouseId: form.value.sourceWarehouseId,
        targetWarehouseId: form.value.targetWarehouseId,
        stockCode: it.stockCode || undefined,
      }
    })
  }
  return {
    id: form.value.id,
    orderNo: form.value.orderNo,
    orderStatus,
    remark: form.value.remark,
    totalQuantity: form.value.totalQuantity,
    totalAmount: form.value.totalAmount,
    sourceWarehouseId: form.value.sourceWarehouseId,
    targetWarehouseId: form.value.targetWarehouseId,
    details: details
  }
}
const doSave = (orderStatus = 0) => {
  movementForm.value?.validate((valid) => {
    // 校验
    if (!valid) {
      return ElMessage.error('请填写必填项')
    }

    const params = getParams(orderStatus)
    loading.value = true
    if (params.id) {
      updateMovementOrder(params).then((res) => {
        if (res.code === 200) {
          ElMessage.success(res.msg)
          close()
        } else {
          ElMessage.error(res.msg)
        }
      }).finally(()=>{
        loading.value = false
      })
    } else {
      addMovementOrder(params).then((res) => {
        if (res.code === 200) {
          ElMessage.success(res.msg)
          close()
        } else {
          ElMessage.error(res.msg)
        }
      }).finally(()=>{
        loading.value = false
      })
    }
  })
}

const doMovement = async () => {
  await proxy?.$modal.confirm('确认移库吗？');
  movementForm.value?.validate((valid) => {
    // 校验
    if (!valid) {
      return ElMessage.error('请填写必填项')
    }
    if (!form.value.details?.length) {
      return ElMessage.error('请选择商品')
    }
    const invalidQuantityList = form.value.details.filter(it => !it.quantity)
    if (invalidQuantityList?.length) {
      return ElMessage.error('请选择移库数量')
    }
    const invalidLocationList = form.value.details.filter(it => !it.stockCode)
    if (invalidLocationList?.length) {
      return ElMessage.error('请选择库位')
    }

    //('提交前校验',form.value)
    const params = getParams(1)
    loading.value = true
    movement(params).then((res) => {
      if (res.code === 200) {
        ElMessage.success('移库成功')
        close()
      } else {
        ElMessage.error(res.msg)
      }
    }).finally(()=>{
      loading.value = false
    })
  })
}

const updateToInvalid = async () => {
  await proxy?.$modal.confirm('确认作废移库单吗？');
  doSave(-1)
}

const route = useRoute();
onMounted(() => {
  const id = route.query && route.query.id;
  if (id) {
    loadDetail(id)
  } else {
    form.value.orderNo = 'YK' + generateNo()
  }
})


// 获取移库单详情
const loadDetail = (id) => {
  loading.value = true
  getMovementOrder(id).then((response) => {

    if (response.data.details?.length) {
      selectedInventory.value = response.data.details.map(it => {
        return {
          id: it.id,
          skuId: it.skuId,
          warehouseId: it.sourceWarehouseId
        }
      })
    }
    form.value = {...response.data}
    inventorySelectRef.value.setWarehouseId(form.value.sourceWarehouseId)
    Promise.resolve();
  }).then(() => {
  }).finally(() => {
    loading.value = false
  })
}

const handleChangeSourceWarehouse = (e) => {
  form.value.details = []
  inventorySelectRef.value.setWarehouseId(form.value.sourceWarehouseId)
}

const handleChangeTargetWarehouse = (e) => {
  form.value.details.forEach(it => {
    it.targetWarehouseId = e
  })

}

const handleChangeQuantity = () => {
  let sum = 0
  form.value.details.forEach(it => {
    if (it.quantity) {
      sum += Number(it.quantity)
    }
  })
  form.value.totalQuantity = sum
}

const handleDeleteDetail = (row, index) => {
  if (row.id) {
    proxy.$modal.confirm('确认删除本条商品明细吗？如确认会立即执行！').then(function () {
      loading.value = true
      return delMovementOrderDetail(row.id);
    }).then(() => {
      form.value.details.splice(index, 1)
      proxy.$modal.msgSuccess("删除成功");
    }).finally(() => {
      loading.value = false
    })
  } else {
    form.value.details.splice(index, 1)
  }
  const indexOfSelected = selectedInventory.value.findIndex(it => getWarehouseAndSkuKey(it) === getSourceWarehouseAndSkuKey(row))
  selectedInventory.value.splice(indexOfSelected, 1)
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
  justify-content: space-between;
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
