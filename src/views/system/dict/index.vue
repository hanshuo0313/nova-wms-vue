<template>
   <div class="app-container">
      <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px"
               style="display: flex; flex-wrap: wrap; align-items: flex-start;">
         <el-form-item label="字典名称" prop="dictName">
            <el-input
               v-model="queryParams.dictName"
               placeholder="请输入字典名称"
               clearable
               style="width: 240px"
               @keyup.enter="handleQuery"
            />
         </el-form-item>
         <el-form-item label="字典类型" prop="dictType">
            <el-input
               v-model="queryParams.dictType"
               placeholder="请输入字典类型"
               clearable
               style="width: 240px"
               @keyup.enter="handleQuery"
            />
         </el-form-item>
         <el-form-item label="状态" prop="status">
            <el-select
               v-model="queryParams.status"
               placeholder="字典状态"
               clearable
               style="width: 240px"
            >
               <el-option
                  v-for="dict in sys_normal_disable"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
               />
            </el-select>
         </el-form-item>
         <el-form-item label="创建时间" style="width: 308px">
            <el-date-picker
               v-model="dateRange"
               value-format="YYYY-MM-DD HH:mm:ss"
               type="daterange"
               range-separator="-"
               start-placeholder="开始日期"
               end-placeholder="结束日期"
               :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]"
            ></el-date-picker>
         </el-form-item>
         <el-form-item style="margin-left: auto">
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
         </el-form-item>
      </el-form>

      <el-row :gutter="10" class="mb8">
         <el-col :span="1.5">
            <el-button
               type="primary"
               plain
               icon="Plus"
               @click="handleAdd"
               v-hasPermi="['system:dict:add']"
            >新增</el-button>
         </el-col>
         <el-col :span="1.5">
            <el-button
               type="success"
               plain
               icon="Edit"
               :disabled="single"
               @click="handleUpdate"
               v-hasPermi="['system:dict:edit']"
            >修改</el-button>
         </el-col>
         <el-col :span="1.5">
            <el-button
               type="danger"
               plain
               icon="Delete"
               :disabled="multiple"
               @click="handleDelete"
               v-hasPermi="['system:dict:remove']"
            >删除</el-button>
         </el-col>
         <el-col :span="1.5">
            <el-button
               type="warning"
               plain
               icon="Download"
               @click="handleExport"
               v-hasPermi="['system:dict:export']"
            >导出</el-button>
         </el-col>
         <el-col :span="1.5">
            <el-button
               type="danger"
               plain
               icon="Refresh"
               @click="handleRefreshCache"
               v-hasPermi="['system:dict:remove']"
            >刷新缓存</el-button>
         </el-col>
         <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
      </el-row>

      <el-table v-loading="loading" :data="typeList" @selection-change="handleSelectionChange">
         <el-table-column type="selection" width="55" align="center" />
         <el-table-column label="字典编号" align="center" prop="dictId" />
         <el-table-column label="字典名称" align="center" prop="dictName" :show-overflow-tooltip="true"/>
         <el-table-column label="字典类型" align="center" :show-overflow-tooltip="true">
            <template #default="scope">
               <router-link :to="'/system/dict-data/index/' + scope.row.dictId" class="link-type">
                  <span>{{ scope.row.dictType }}</span>
               </router-link>
            </template>
         </el-table-column>
         <el-table-column label="状态" align="center" prop="status">
            <template #default="scope">
               <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
            </template>
         </el-table-column>
         <el-table-column label="备注" align="center" prop="remark" :show-overflow-tooltip="true" />
         <el-table-column label="创建时间" align="center" prop="createTime" width="180">
            <template #default="scope">
               <span>{{ parseTime(scope.row.createTime) }}</span>
            </template>
         </el-table-column>
        <el-table-column label="操作" align="center" width="320" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-button link type="primary" icon="Plus" @click="handleOpenDataPage(scope.row)" v-hasPermi="['system:dict:add']">字典明细</el-button>
            <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['system:dict:edit']">修改</el-button>
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['system:dict:remove']">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination
         v-show="total > 0"
         :total="total"
         v-model:page="queryParams.pageNum"
         v-model:limit="queryParams.pageSize"
         @pagination="getList"
      />

      <!-- 添加或修改参数配置对话框 -->
      <el-dialog :title="title" v-model="open" width="500px" append-to-body>
         <el-form ref="dictRef" :model="form" :rules="rules" label-width="80px">
            <el-form-item label="字典名称" prop="dictName">
               <el-input v-model="form.dictName" placeholder="请输入字典名称" />
            </el-form-item>
            <el-form-item label="字典类型" prop="dictType">
               <el-input v-model="form.dictType" placeholder="请输入字典类型" />
            </el-form-item>
            <el-form-item label="状态" prop="status">
               <el-radio-group v-model="form.status">
                  <el-radio
                     v-for="dict in sys_normal_disable"
                     :key="dict.value"
                     :label="dict.value"
                  >{{ dict.label }}</el-radio>
               </el-radio-group>
            </el-form-item>
            <el-form-item label="备注" prop="remark">
               <el-input v-model="form.remark" type="textarea" placeholder="请输入内容"></el-input>
            </el-form-item>
         </el-form>
         <template #footer>
            <div class="dialog-footer">
               <el-button type="primary" @click="submitForm">确 定</el-button>
               <el-button @click="cancel">取 消</el-button>
            </div>
         </template>
      </el-dialog>
     <!-- 字典数据管理对话框 -->
     <el-dialog :title="dataPageTitle" v-model="dataPageOpen" width="1200px" append-to-body>
       <div class="app-container">
         <el-form :model="dataQueryParams" ref="dataQueryRef" :inline="true" v-show="dataShowSearch">
           <el-form-item label="字典类型" prop="dictType">
             <el-input v-model="dataQueryParams.dictTypeName" readonly style="width: 200px" />
           </el-form-item>
           <el-form-item label="字典标签" prop="dictLabel">
             <el-input
               v-model="dataQueryParams.dictLabel"
               placeholder="请输入字典标签"
               clearable                     style="width: 200px"
               @keyup.enter="handleDataQuery"
             />
           </el-form-item>
           <el-form-item label="状态" prop="status">
             <el-select v-model="dataQueryParams.status" placeholder="数据状态" clearable style="width: 200px">
               <el-option
                 v-for="dict in sys_normal_disable"
                 :key="dict.value"
                 :label="dict.label"
                 :value="dict.value"
               />
             </el-select>
           </el-form-item>
           <el-form-item>
             <el-button type="primary" icon="Search" @click="handleDataQuery">搜索</el-button>
             <el-button icon="Refresh" @click="resetDataQuery">重置</el-button>
           </el-form-item>
         </el-form>

         <el-row :gutter="10" class="mb8">
           <el-col :span="1.5">
             <el-button
               type="primary"
               plain
               icon="Plus"
               @click="handleAddDictData"
               v-hasPermi="['system:dict:add']"
             >新增</el-button>
           </el-col>
           <el-col :span="1.5">
             <el-button
               type="success"
               plain
               icon="Edit"
               :disabled="dataSingle"
               @click="handleUpdateData"
               v-hasPermi="['system:dict:edit']"
             >修改</el-button>
           </el-col>
           <el-col :span="1.5">
             <el-button
               type="danger"
               plain
               icon="Delete"
               :disabled="dataMultiple"
               @click="handleDeleteData"
               v-hasPermi="['system:dict:remove']"
             >删除</el-button>
           </el-col>
           <right-toolbar v-model:showSearch="dataShowSearch" @queryTable="getDataList"></right-toolbar>
         </el-row>

         <el-table v-loading="dataLoading" :data="dataList" @selection-change="handleDataSelectionChange">
           <el-table-column type="selection" width="55" align="center" />
           <el-table-column label="字典编码" align="center" prop="dictCode" />
           <el-table-column label="字典标签" align="center" prop="dictLabel">
             <template #default="scope">
               <span v-if="(scope.row.listClass == '' || scope.row.listClass == 'default') && (scope.row.cssClass == '' || scope.row.cssClass == null)">{{ scope.row.dictLabel }}</span>
               <el-tag v-else :type="scope.row.listClass == 'primary' ? '' : scope.row.listClass" :class="scope.row.cssClass">{{ scope.row.dictLabel }}</el-tag>
             </template>
           </el-table-column>
           <el-table-column label="字典键值" align="center" prop="dictValue" />
           <el-table-column label="字典排序" align="center" prop="dictSort" />
           <el-table-column label="状态" align="center" prop="status">
             <template #default="scope">
               <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
             </template>
           </el-table-column>
           <el-table-column label="备注" align="center" prop="remark" :show-overflow-tooltip="true" />
           <el-table-column label="创建时间" align="center" prop="createTime" width="180">
             <template #default="scope">
               <span>{{ parseTime(scope.row.createTime) }}</span>
             </template>
           </el-table-column>
           <el-table-column label="操作" align="center" width="160" class-name="small-padding fixed-width">
             <template #default="scope">
               <el-button link type="primary" icon="Edit" @click="handleUpdateData(scope.row)" v-hasPermi="['system:dict:edit']">修改</el-button>
               <el-button link type="primary" icon="Delete" @click="handleDeleteData(scope.row)" v-hasPermi="['system:dict:remove']">删除</el-button>
             </template>
           </el-table-column>
         </el-table>

         <pagination
           v-show="dataTotal > 0"
           :total="dataTotal"
           v-model:page="dataQueryParams.pageNum"
           v-model:limit="dataQueryParams.pageSize"
           @pagination="getDataList"
         />
       </div>
       <template #footer>
         <div class="dialog-footer">
           <el-button @click="dataPageOpen = false">关 闭</el-button>
         </div>
       </template>
     </el-dialog>

     <!-- 新增或修改字典数据对话框 -->
     <el-dialog :title="dataFormTitle" v-model="dataFormOpen" width="500px" append-to-body>
       <el-form ref="dataFormRef" :model="dataForm" :rules="dataFormRules" label-width="80px">
         <el-form-item label="字典类型">
           <el-input v-model="dataForm.dictType" :disabled="true" />
         </el-form-item>
         <el-form-item label="数据标签" prop="dictLabel">
           <el-input v-model="dataForm.dictLabel" placeholder="请输入数据标签" />
         </el-form-item>
         <el-form-item label="数据键值" prop="dictValue">
           <el-input v-model="dataForm.dictValue" placeholder="请输入数据键值" />
         </el-form-item>
         <el-form-item label="样式属性" prop="cssClass">
           <el-input v-model="dataForm.cssClass" placeholder="请输入样式属性" />
         </el-form-item>
         <el-form-item label="显示排序" prop="dictSort">
           <el-input-number v-model="dataForm.dictSort" controls-position="right" :min="0" />
         </el-form-item>
         <el-form-item label="回显样式" prop="listClass">
           <el-select v-model="dataForm.listClass">
             <el-option
               v-for="item in listClassOptions"
               :key="item.value"
               :label="item.label + '(' + item.value + ')'"
               :value="item.value"
             ></el-option>
           </el-select>
         </el-form-item>
         <el-form-item label="状态" prop="status">
           <el-radio-group v-model="dataForm.status">
             <el-radio
               v-for="dict in sys_normal_disable"
               :key="dict.value"
               :label="dict.value"
             >{{ dict.label }}</el-radio>
           </el-radio-group>
         </el-form-item>
         <el-form-item label="备注" prop="remark">
           <el-input v-model="dataForm.remark" type="textarea" placeholder="请输入内容"></el-input>
         </el-form-item>
       </el-form>
       <template #footer>
         <div class="dialog-footer">
           <el-button type="primary" @click="submitDataForm">确 定</el-button>
           <el-button @click="cancelDataForm">取 消</el-button>
         </div>
       </template>
     </el-dialog>
   </div>
</template>

<script setup name="Dict">
import useDictStore from '@/store/modules/dict'
import { listType, getType, delType, addType, updateType, refreshCache, optionselect as getDictOptionselect } from "@/api/system/dict/type";
import { listData, getData, delData, addData, updateData } from "@/api/system/dict/data";

const { proxy } = getCurrentInstance();
const { sys_normal_disable } = proxy.useDict("sys_normal_disable");

const typeList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");
const dateRange = ref([]);

// 字典数据管理相关（完整列表页面）
const dataPageOpen = ref(false);
const dataPageTitle = ref("");
const dataLoading = ref(true);
const dataShowSearch = ref(true);
const dataList = ref([]);
const dataIds = ref([]);
const dataSingle = ref(true);
const dataMultiple = ref(true);
const dataTotal = ref(0);
const typeOptions = ref([]);

// 字典数据表单相关（新增/修改弹窗）
const dataFormOpen = ref(false);
const dataFormTitle = ref("");
const dataForm = ref({});
const listClassOptions = ref([
  { value: "default", label: "默认" },
  { value: "primary", label: "主要" },
  { value: "success", label: "成功" },
  { value: "info", label: "信息" },
  { value: "warning", label: "警告" },
  { value: "danger", label: "危险" }
]);

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    dictName: undefined,
    dictType: undefined,
    status: undefined
  },
  rules: {
    dictName: [{ required: true, message: "字典名称不能为空", trigger: "blur" }],
    dictType: [{ required: true, message: "字典类型不能为空", trigger: "blur" }]
  },
});

const dataQueryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  dictType: undefined,
  dictLabel: undefined,
  status: undefined
});

const dataFormRules = reactive({
  dictLabel: [{ required: true, message: "数据标签不能为空", trigger: "blur" }],
  dictValue: [{ required: true, message: "数据键值不能为空", trigger: "blur" }],
  dictSort: [{ required: true, message: "数据顺序不能为空", trigger: "blur" }]
});

const { queryParams, form, rules } = toRefs(data);

/** 查询字典类型列表 */
function getList() {
  loading.value = true;
  listType(proxy.addDateRange(queryParams.value, dateRange.value)).then(response => {
    typeList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}

/** 查询字典类型列表（用于下拉框） */
function getTypeList(dictType) {
  getDictOptionselect().then(response => {
    typeOptions.value = response.data;
    if (dictType) {
      dataQueryParams.dictType = dictType;
      // 设置字典类型名称用于显示
      const selectedType = typeOptions.value.find(item => item.dictType === dictType);
      dataQueryParams.dictTypeName = selectedType ? selectedType.dictName : dictType;
    } else if (typeOptions.value.length > 0) {
      dataQueryParams.dictType = typeOptions.value[0].dictType;
      dataQueryParams.dictTypeName = typeOptions.value[0].dictName;
    }
    getDataList();
  });
}

/** 查询字典数据列表 */
function getDataList() {
  dataLoading.value = true;
  listData(dataQueryParams).then(response => {
    dataList.value = response.rows;
    dataTotal.value = response.total;
    dataLoading.value = false;
  });
}

/** 取消按钮 */
function cancel() {
  open.value = false;
  reset();
}

/** 表单重置 */
function reset() {
  form.value = {
    dictId: undefined,
    dictName: undefined,
    dictType: undefined,
    status: "1",
    remark: undefined
  };
  proxy.resetForm("dictRef");
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = [];
  proxy.resetForm("queryRef");
  handleQuery();
}

/** 新增按钮操作 */
function handleAdd() {
  reset();
  open.value = true;
  title.value = "添加字典类型";
}

/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.dictId);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const dictId = row.dictId || ids.value;
  getType(dictId).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改字典类型";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["dictRef"].validate(valid => {
    if (valid) {
      if (form.value.dictId != undefined) {
        updateType(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addType(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功");
          open.value = false;
          getList();
        });
      }
    }
  });
}

/** 删除按钮操作 */
function handleDelete(row) {
  const dictIds = row.dictId || ids.value;
  proxy.$modal.confirm('是否确认删除字典编号为"' + dictIds + '"的数据项？').then(function() {
    return delType(dictIds);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download("system/dict/type/export", {
    ...queryParams.value
  }, `dict_${new Date().getTime()}.xlsx`);
}

/** 刷新缓存按钮操作 */
function handleRefreshCache() {
  refreshCache().then(() => {
    proxy.$modal.msgSuccess("刷新成功");
    useDictStore().cleanDict();
  });
}

// ==================== 字典数据管理功能 ====================

/** 打开字典数据管理页面 */
function handleOpenDataPage(row) {
  dataPageOpen.value = true;
  dataPageTitle.value = "字典数据管理 - " + (row.dictName || row.dictType);
  getTypeList(row.dictType);
}

/** 字典数据搜索 */
function handleDataQuery() {
  dataQueryParams.pageNum = 1;
  getDataList();
}

/** 字典数据重置 */
function resetDataQuery() {
  proxy.resetForm("dataQueryRef");
  if (typeOptions.value.length > 0) {
    dataQueryParams.dictType = typeOptions.value[0].dictType;
  }
  handleDataQuery();
}

/** 新增字典数据 */
function handleAddDictData() {
  resetDataForm();
  dataFormOpen.value = true;
  dataFormTitle.value = "添加字典数据";
  dataForm.value.dictType = dataQueryParams.dictType;
}

/** 修改字典数据 */
function handleUpdateData(row) {
  resetDataForm();
  const dictCode = row.dictCode || dataIds.value;
  getData(dictCode).then(response => {
    dataForm.value = response.data;
    dataFormOpen.value = true;
    dataFormTitle.value = "修改字典数据";
  });
}

/** 删除字典数据 */
function handleDeleteData(row) {
  const dictCodes = row.dictCode || dataIds.value;
  proxy.$modal.confirm('是否确认删除字典编码为"' + dictCodes + '"的数据项？').then(function() {
    return delData(dictCodes);
  }).then(() => {
    getDataList();
    proxy.$modal.msgSuccess("删除成功");
    useDictStore().removeDict(dataQueryParams.dictType);
  }).catch(() => {});
}

/** 字典数据多选框选中 */
function handleDataSelectionChange(selection) {
  dataIds.value = selection.map(item => item.dictCode);
  dataSingle.value = selection.length != 1;
  dataMultiple.value = !selection.length;
}

/** 字典数据表单重置 */
function resetDataForm() {
  dataForm.value = {
    dictCode: undefined,
    dictLabel: undefined,
    dictValue: undefined,
    cssClass: undefined,
    listClass: "default",
    dictSort: 0,
    status: "1",
    remark: undefined
  };
  proxy.resetForm("dataFormRef");
}

/** 字典数据表单取消 */
function cancelDataForm() {
  dataFormOpen.value = false;
  resetDataForm();
}

/** 字典数据表单提交 */
function submitDataForm() {
  proxy.$refs["dataFormRef"].validate(valid => {
    if (valid) {
      if (dataForm.value.dictCode != undefined) {
        updateData(dataForm.value).then(response => {
          useDictStore().removeDict(dataQueryParams.dictType);
          proxy.$modal.msgSuccess("修改成功");
          dataFormOpen.value = false;
          getDataList();
        });
      } else {
        addData(dataForm.value).then(response => {
          useDictStore().removeDict(dataQueryParams.dictType);
          proxy.$modal.msgSuccess("新增成功");
          dataFormOpen.value = false;
          getDataList();
        });
      }
    }
  });
}

getList();
</script>


