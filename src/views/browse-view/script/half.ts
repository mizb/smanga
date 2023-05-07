import {defineComponent, watchSyncEffect} from 'vue';
import {get_image_blob} from '@/api';
import {global_get, global_get_array, global_set} from '@/utils';
import {ElMessage} from 'element-plus';
import {config} from '@/store';
import {add_history} from '@/api/history';
import operationCover from '../components/operation-cover.vue';
import chapterListMenu from '../components/chapter-list-menu.vue';
import bookmark from '../components/bookmark.vue';
import {get_chapter_images} from '@/api/browse';
import browsePager from '@/components/browse-pager.vue';
import rightSidebar from '../components/right-sidebar.vue';
import i18n from '@/i18n';
const {t} = i18n.global;
export default defineComponent({
	name: 'half',

	// 数据
	data() {
		return {
			// 分页器设置
			small: false,
			disabled: false,
			background: true,
			//图片路径 blob
			imgSrc: '',
			// 图片路径列表
			imgPathList: [] as string[],
			// 是否正在加载图片 (单页模式加载动画待制作)
			loading: false,
			canvasHeight: 0,
			canvasWidth: 0,
		};
	},

	// 传值
	props: [],

	// 组件
	components: {
		operationCover,
		chapterListMenu,
		bookmark,
		browsePager,
		rightSidebar,
	},

	computed: {
		// 页脚是否展示
		browseFooter() {
			return config.browseFooter;
		},
		// 章节路径
		path() {
			return this.$route.query.path as string;
		},
		// 章节名称
		name() {
			return this.$route.query.name;
		},
		// 章节列表
		chapterList() {
			return global_get_array('chapterList');
		},
		chapterInfo() {
			return this.chapterList[this.index] || {};
		},
		// 章节的坐标索引
		index() {
			const chapterList = this.chapterList;

			for (let i = 0; i < chapterList.length; i++) {
				if (this.name === chapterList[i].chapterName) {
					//缓存章节坐标
					global_set('chapterIndex', i);
					return i;
				}
			}

			return -1;
		},
		// 导航及按钮展示开关
		browseTop() {
			return config.browseTop;
		},
		// 图片总数
		count() {
			return this.imgPathList.length;
		},
	},

	// 方法
	methods: {
		/**
		 * 页码变更
		 * @param page
		 */
		async page_change(page: number) {
			const even = page % 2 === 0;
			console.log(even);

			const pageImage = this.imgPathList[page - 1];
			global_set('page', page);
			global_set('pageImage', pageImage);

			const res: any = await get_image_blob(pageImage);
			// this.imgSrc = res.data;

			const img = new Image();
			img.src = res.data;

			const canvas = <HTMLCanvasElement>document.getElementById('canvas-cut');

			if (!canvas) return false;

            const context = canvas.getContext('2d');
            
            if (!context) return false;

			//处理toDataURL遇跨域资源导致的报错
			img.crossOrigin = 'Anonymous';

			// context.fillStyle = '#ffffff';
			// context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

			// this.canvasHeight = 0;
			img.onload = () => {
				const h = img.naturalHeight;
				const w = img.naturalWidth;

				canvas.height = h;
                canvas.width = w / 2;
                
				if (even) {
					context.drawImage(img, w / 2, 0, w, h, 0, 0, w, h);
				} else {
					context.drawImage(img, 0, 0, w, h, 0, 0, w, h);
				}

				const imgbase64 = canvas.toDataURL('image/png');
				this.imgSrc = imgbase64;

			};
		},

		/**
		 * 上一页
		 */
		beforePage() {
			(this.$refs as any).pager.before();
		},

		/**
		 * 下一页
		 */
		nextPage() {
			(this.$refs as any).pager.next();
		},

		/**
		 * 重载页面
		 */
		async reload_page(page = 1, addHistory = true) {
			if (addHistory) add_history();
			// 加载图片列表
			const res = await get_chapter_images();

			switch (res.data.status) {
				case 'uncompressed':
					(this.$refs as any).pager.page_change(page);
					setTimeout(() => {
						(this.$refs as any).pager.reload();
					}, 2000);
					break;
				case 'compressing':
					this.imgPathList = res.data.list;
					(this.$refs as any).pager.page_change(page);
					setTimeout(() => {
						(this.$refs as any).pager.reload();
					}, 2000);
					break;
				case 'compressed':
					this.imgPathList = res.data.list;
					(this.$refs as any).pager.page_change(page);
					break;
				default:
					this.imgPathList = res.data.list;
					(this.$refs as any).pager.page_change(page);
			}

			this.imgPathList = this.imgPathList.concat(this.imgPathList);

			this.imgPathList.sort();
		},

		/**
		 * 上一页
		 * */
		async before() {
			if (this.index == 0) {
				ElMessage.warning(t('page.firstChapter'));
				return false;
			}

			if (!this.index) return;

			await this.$router.push({
				name: this.$route.name as string,
				query: {
					name: this.chapterList[this.index - 1].chapterName,
					path: this.chapterList[this.index - 1].chapterPath,
				},
				params: {page: 1},
			});

			this.update_chapter_info();

			/**
			 * 刷新页面
			 * 自定义重载方法没有重置滚动条,导致vant list不断触发触底事件
			 * 因此暂时采用刷新页面的方式解决
			 */
			this.reload_page();
		},

		/**
		 * 下一页
		 * */
		async next() {
			if (this.index == this.chapterList.length - 1) {
				ElMessage.warning(t('page.lastChapter'));
				return false;
			}

			await this.$router.push({
				name: this.$route.name as string,
				query: {
					name: this.chapterList[this.index + 1].chapterName,
					path: this.chapterList[this.index + 1].chapterPath,
				},
				params: {page: 1},
			});

			this.update_chapter_info();

			// 刷新页面
			this.reload_page();
		},

		/**
		 * 选择章节
		 * @param index
		 */
		async change_chapter(index: any) {
			await this.$router.push({
				name: this.$route.name as string,
				query: {
					name: this.chapterList[index].chapterName,
					path: this.chapterList[index].chapterPath,
				},
				params: {page: 1},
			});

			this.update_chapter_info();

			// 重载页面
			this.reload_page();
		},

		/**
		 * 更新阅读缓存
		 */
		update_chapter_info() {
			const chapterInfo = this.chapterInfo;
			global_set('chapterId', chapterInfo.chapterId);
			global_set('chapterName', chapterInfo.chapterName);
			global_set('chapterPath', chapterInfo.chapterPath);
			global_set('chapterCover', chapterInfo.chapterCover);
		},

		// 阅读状态控制
		switch_menu() {
			config.browseTop = !config.browseTop;
		},
		switch_footer() {
			config.browseFooter = !config.browseFooter;
		},
		/**
         * 下载当前图片
         */
        dwonload_image() {
            const src = this.imgSrc;

            const a = document.createElement('a');
            a.href = src;
            a.download = 'smangaImage.png';
            a.click();
        }
	},

	// 生命周期
	created() {
		// 设置浏览模式
		config.browseType = 'half';
		const page = this.$route.params.page || global_get('page') || 1;
		const notAddHistory = this.$route.params.notAddHistory || false;

		// 加载页面
		this.reload_page(Number(page), !notAddHistory);
	},
});