<template>
  <div class="app-container">
    <el-card>
      <el-form :model="queryParams" ref="queryRef" :inline="true" label-width="68px">
        <el-form-item label="原文" prop="sourceText">
          <el-input
            v-model="queryParams.sourceText"
            placeholder="请输入原文"
            clearable
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="译文" prop="targetText">
          <el-input
            v-model="queryParams.targetText"
            placeholder="请输入译文"
            clearable
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="目标语言" prop="targetLang">
          <el-select v-model="queryParams.targetLang" placeholder="请选择目标语言" clearable style="width: 100%">
            <el-option
              v-for="dict in language_type"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="mt20">

      <el-row :gutter="10" class="mb8" type="flex" justify="space-between">
        <el-col :span="6"><span style="font-size: large">术语词典</span></el-col>
        <el-col :span="1.5">
          <el-button
            type="primary"
            plain
            icon="Plus"
            @click="handleAdd"
            v-hasPermi="['wms:glossary:add']"
          >新增</el-button>
          <el-button
            type="warning"
            plain
            icon="Download"
            @click="handleExport"
            v-hasPermi="['wms:glossary:export']"
          >导出</el-button>
        </el-col>
      </el-row>

      <el-table v-loading="loading" :data="glossaryList" border class="mt20">
        <el-table-column label="序号" type="index" width="140" align="center" />
        <el-table-column label="原文" prop="sourceText" />
        <el-table-column label="译文" prop="targetText" />
        <el-table-column label="目标语言" prop="targetLang">
          <template #default="scope">
            <dict-tag :options="language_type" :value="scope.row.targetLang"/>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="right" class-name="small-padding fixed-width">
            <template #default="scope">
                <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['wms:glossary:edit']">修改</el-button>
                <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['wms:glossary:remove']">删除</el-button>
            </template>
        </el-table-column>
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
    <!-- 添加或修改术语词典对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="glossaryRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="原文" prop="sourceText">
          <el-input v-model="form.sourceText" placeholder="请输入原文" />
        </el-form-item>
        <el-form-item label="译文" prop="targetText">
          <el-input v-model="form.targetText" placeholder="请输入译文" />
        </el-form-item>
        <el-form-item label="目标语言" prop="targetLang">
          <el-select v-model="form.targetLang" placeholder="请选择目标语言" clearable style="width: 100%">
            <el-option
              v-for="dict in language_type"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Glossary">
import { listGlossary, getGlossary, delGlossary, addGlossary, updateGlossary } from "@/api/wms/glossary";

const { proxy } = getCurrentInstance();

const glossaryList = ref([]);
const open = ref(false);
const buttonLoading = ref(false);
const loading = ref(true);
const ids = ref([]);
const total = ref(0);
const title = ref("");
const { language_type } = proxy.useDict("language_type");
const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    sourceText: undefined,
    targetText: undefined,
    targetLang: undefined
  },
  rules: {
    id: [
      { required: true, message: "不能为空", trigger: "blur" }
    ],
    sourceText: [
      { required: true, message: "原文不能为空", trigger: "blur" }
    ],
    targetText: [
      { required: true, message: "译文不能为空", trigger: "blur" }
    ],
    targetLang: [
      { required: true, message: "目标语言不能为空", trigger: "blur" }
    ]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询术语词典列表 */
function getList() {
  loading.value = true;
  listGlossary(queryParams.value).then(response => {
    glossaryList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}

// 取消按钮
function cancel() {
  open.value = false;
  reset();
}

// 表单重置
function reset() {
  form.value = {
    id: null,
    sourceText: null,
    targetText: null,
    createTime: null,
    targetLang: null
  };
  proxy.resetForm("glossaryRef");
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

/** 新增按钮操作 */
function handleAdd() {
  reset();
  open.value = true;
  title.value = "添加术语词典";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getGlossary(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改术语词典";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["glossaryRef"].validate(valid => {
    if (valid) {
      buttonLoading.value = true;
      if (form.value.id != null) {
        updateGlossary(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
          refreshGlossaryCache(); // 自动刷新翻译词典缓存
        }).finally(() => {
          buttonLoading.value = false;
        });
      } else {
        addGlossary(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功");
          open.value = false;
          getList();
          refreshGlossaryCache(); // 自动刷新翻译词典缓存
        }).finally(() => {
          buttonLoading.value = false;
        });
      }
    }
  });
}

/** 删除按钮操作 */
function handleDelete(row) {
  const _ids = row.id || ids.value;
  proxy.$modal.confirm('是否确认删除术语词典编号为"' + _ids + '"的数据项？').then(function() {
    loading.value = true;
    return delGlossary(_ids);
  }).then(() => {
    loading.value = true;
    getList();
    refreshGlossaryCache(); // 删除后也自动刷新缓存
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {
  }).finally(() => {
    loading.value = false;
  });
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('wms/glossary/export', {
    ...queryParams.value
  }, `glossary_${new Date().getTime()}.xlsx`)
}

/** 内部方法：刷新翻译词典缓存（内存 + localStorage） */
function refreshGlossaryCache() {
  if (window.__translationCache && typeof window.__translationCache.clearGlossary === 'function') {
    window.__translationCache.clearGlossary();
    console.log('[术语词典] 已自动刷新翻译词典缓存');
  }
}

getList();
</script>
