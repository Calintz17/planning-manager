// assets/js/forecast.js
// UI + state pour les 3 blocs Forecast : Totals, Task Split, Weekly, Hourly (+ validations)
import { ROMAN } from './store.js';

const REGIONS = ['Europe','Americas','Greater China','Japan','South Korea','SEAO'];
const REGION_KEYS = ['EU','US','CN','JP','KR','SEAO'];
const TASKS = [
  'Email','Call','Clienteling','Chat','DELIVERY','DELIVERY ISSUE/DELAY','DELIVERY OPEN INVESTIGATION','DELIVERY RETURN TO SENDER','DOC','FRAUD','PAYMENT','PAYMENT NOT CAPTURED','REFUNDS','REFUNDS STATUT','REPAIR','RETURN','RETURN IN STORE','RETURN KO','SHORT SHIPMENT'
];
const HOURS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];
const DAYS = ['1-Monday','2-Tuesday','3-Wednesday','4-Thursday','5-Friday','6-Saturday','7-Sunday'];

const pctToNumber = str => parseFloat(String(str).replace('%','').replace(',','.')) || 0;
const num = v => parseFloat(String(v).replace(',','.')) || 0;

function setBadge(cell, value, tol=0.1){
  const diff = Math.abs(value-100);
  const klass = (diff<=tol) ? 'ok' : (value>100?'err':'warn');
  cell.innerHTML = `<span class="badge ${klass}">${value.toFixed(1)}%</span>`;
}

/* ===== Defaults ===== */
const DEFAULT_TOTALS = {
  'Europe': 90000, 'Americas': 49713, 'Greater China': 119038,
  'Japan': 39269, 'South Korea': 39269, 'SEAO': 25650
};
const DEFAULT_TASK_SPLIT = {
  'Europe':[28,30,4,0,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
  'Americas':[28,29,4,1,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
  'Greater China':[4,4,20,34,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
  'Japan':[28,30,4,0,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
  'South Korea':[28,34,0,0,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
  'SEAO':[28,30,4,0,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1]
};
// Weekly % (52 valeurs / région clé)
const WEEKLY = {
  EU: ['2,34','2,09','2,02','2,00','1,85','2,01','2,02','1,63','1,42','1,90','2,04','2,02','1,97','2,02','2,36','2,40','2,34','2,25','2,17','2,43','2,52','2,37','2,54','2,66','2,59','2,56','2,69','2,67','2,62','2,11','1,94','1,63','1,49','1,58','1,50','1,42','1,46','1,53','1,39','1,32','1,41','1,15','1,19','1,01','1,34','1,35','1,37','1,36','1,65','2,10','2,39','1,80'],
  US: ['2,26','2,08','2,24','2,34','1,99','2,33','1,86','1,69','1,97','2,16','2,10','2,00','2,02','1,95','2,06','1,99','1,95','2,03','2,19','2,42','2,11','1,85','2,15','2,46','2,47','2,25','1,85','1,94','1,98','2,03','1,84','1,85','1,64','1,82','1,62','1,51','1,77','1,50','1,47','1,54','1,22','1,46','1,61','1,44','1,44','1,36','1,56','2,02','1,90','2,08','2,78','1,86'],
  CN: ['2,00','1,95','2,27','2,12','2,32','1,98','1,92','1,85','1,85','1,93','2,12','2,13','2,24','1,99','2,27','2,05','2,10','1,81','2,06','2,84','2,19','1,77','1,93','1,73','1,79','1,76','1,53','1,72','2,15','2,06','2,20','2,65','1,81','1,76','1,53','1,75','1,74','1,69','1,75','1,41','1,59','1,68','1,65','1,86','1,72','1,93','1,75','1,74','1,56','1,88','2,12','1,82'],
  JP: ['2,24','2,01','1,93','1,75','1,54','1,68','1,74','1,73','1,44','2,37','2,22','2,10','1,88','1,80','1,99','1,85','1,77','1,59','1,59','1,93','1,81','1,41','1,88','1,86','1,76','1,61','1,76','1,86','1,85','1,90','1,71','1,67','1,48','1,52','1,61','1,75','1,61','1,75','1,74','1,66','1,61','1,74','1,69','1,46','1,95','2,31','1,96','2,67','3,03','3,20','3,34','3,68'],
  KR: ['1,99','1,99','1,92','1,81','1,98','1,77','2,07','1,88','2,04','2,51','2,48','2,28','2,41','2,44','2,38','2,66','2,39','2,12','2,03','1,97','2,69','2,50','1,97','2,28','2,09','1,96','1,79','1,82','1,92','1,81','1,74','1,72','1,51','1,80','1,74','1,93','1,92','1,15','2,15','1,55','1,70','1,69','1,54','1,35','1,68','1,67','1,48','1,33','1,47','1,44','1,80','1,69'],
  SEAO: ['1,55','2,41','2,26','1,84','1,94','1,87','2,06','1,82','1,77','1,88','1,94','1,66','1,35','1,68','1,69','1,59','2,51','2,14','1,91','1,60','1,87','1,60','2,05','1,57','1,54','1,55','1,86','1,49','2,18','1,95','1,79','1,06','1,30','3,14','2,06','1,85','1,87','1,83','1,95','1,82','1,61','1,79','1,86','1,84','1,86','1,88','2,24','2,18','2,70','2,87','3,48','1,90']
};
// Hourly : 7 lignes / région, tab-separated : [DayLabel, Day%, 26 colonnes heures %]
const HOURLY = {
  'Europe': [
    '1-Monday\t18\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,9\t3,8\t16,5\t12,0\t10,5\t10,5\t9,4\t10,5\t8,8\t7,9\t6,1\t2,3\t0,3\t0,2\t0,1\t0,0\t0,0\t0,0\t0,0',
    '2-Tuesday\t17\t0,1\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t0,2\t1,1\t4,0\t13,7\t11,2\t10,4\t10,3\t10,6\t9,5\t9,0\t8,8\t7,7\t2,8\t0,5\t0,1\t0,1\t0,1\t0,0\t0,0\t0,0',
    '3-Wednesday\t18\t0,1\t0,0\t0,1\t0,0\t0,0\t0,0\t0,1\t0,2\t1,3\t4,1\t16,0\t12,6\t10,5\t9,9\t9,6\t9,1\t9,1\t8,0\t6,2\t2,3\t0,6\t0,3\t0,1\t0,1\t0,0\t0,0\t0,0',
    '4-Thursday\t16\t0,0\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t1,0\t4,0\t14,1\t12,7\t10,1\t10,1\t9,9\t9,9\t9,9\t8,3\t6,5\t2,4\t0,4\t0,3\t0,1\t0,1\t0,0\t0,0\t0,0',
    '5-Friday\t16\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,1\t1,3\t4,0\t15,7\t13,1\t10,9\t9,4\t9,7\t10,2\t9,1\t7,3\t6,0\t1,9\t0,4\t0,4\t0,2\t0,1\t0,0\t0,0\t0,0',
    '6-Saturday\t10\t0,0\t0,1\t0,1\t0,1\t0,1\t0,0\t0,1\t0,1\t0,5\t2,9\t14,9\t13,9\t9,5\t10,4\t8,9\t9,9\t9,7\t8,6\t5,6\t3,8\t0,6\t0,2\t0,2\t0,1\t0,0\t0,0\t0,0',
    '7-Sunday\t4\t0,1\t0,1\t0,1\t0,0\t0,0\t0,1\t0,1\t0,1\t0,8\t0,9\t3,2\t13,8\t10,6\t14,7\t10,6\t10,9\t12,1\t10,0\t8,5\t1,7\t0,6\t0,3\t0,3\t0,1\t0,0\t0,0\t0,0'
  ],
  'Americas': [
    '1-Monday\t18\t0,1\t0,2\t0,0\t0,0\t0,0\t0,1\t0,1\t0,3\t1,6\t5,9\t8,7\t11,8\t10,1\t9,4\t9,5\t10,1\t8,7\t7,3\t5,9\t4,7\t2,7\t1,4\t0,8\t0,2\t0,0\t0,0\t0,0',
    '2-Tuesday\t19\t0,2\t0,0\t0,1\t0,1\t0,1\t0,1\t0,1\t0,6\t1,4\t5,3\t8,9\t11,4\t10,3\t10,1\t9,8\t8,5\t9,0\t8,0\t5,7\t4,3\t3,5\t1,4\t0,6\t0,6\t0,0\t0,0\t0,0',
    '3-Wednesday\t17\t0,3\t0,2\t0,2\t0,1\t0,0\t0,1\t0,1\t0,5\t1,5\t6,0\t7,3\t10,3\t9,4\t10,9\t10,6\t8,5\t8,3\t8,7\t6,5\t4,8\t3,2\t1,1\t0,7\t0,5\t0,0\t0,0\t0,0',
    '4-Thursday\t17\t0,2\t0,1\t0,0\t0,0\t0,1\t0,2\t0,1\t0,5\t1,9\t6,2\t7,8\t11,1\t10,9\t9,5\t10,3\t8,7\t8,5\t8,5\t6,2\t5,1\t2,4\t1,3\t0,4\t0,3\t0,0\t0,0\t0,0',
    '5-Friday\t16\t0,2\t0,1\t0,0\t0,0\t0,0\t0,1\t0,2\t0,7\t1,6\t5,3\t10,0\t10,5\t10,4\t10,2\t9,5\t9,1\t8,2\t9,2\t6,3\t4,1\t2,3\t0,8\t0,5\t0,5\t0,0\t0,0\t0,0',
    '6-Saturday\t9\t0,3\t0,1\t0,2\t0,2\t0,1\t0,6\t0,4\t0,2\t1,3\t5,2\t7,5\t9,8\t10,4\t10,4\t9,1\t10,0\t8,0\t7,7\t6,3\t6,2\t2,8\t1,8\t1,1\t0,5\t0,0\t0,0\t0,0',
    '7-Sunday\t4\t0,5\t0,7\t0,5\t0,4\t0,0\t0,0\t0,2\t0,9\t1,6\t3,9\t7,6\t6,6\t11,2\t9,8\t9,4\t11,7\t8,9\t10,1\t4,1\t3,7\t2,8\t2,3\t2,0\t1,1\t0,0\t0,0\t0,0'
  ],
  'Greater China': [
    '1-Monday\t18\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,9\t3,8\t16,5\t12,0\t10,5\t10,5\t9,4\t10,5\t8,8\t7,9\t6,1\t2,3\t0,3\t0,2\t0,1\t0,0\t0,0\t0,0\t0,0',
    '2-Tuesday\t17\t0,1\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t0,2\t1,1\t4,0\t13,7\t11,2\t10,4\t10,3\t10,6\t9,5\t9,0\t8,8\t7,7\t2,8\t0,5\t0,1\t0,1\t0,1\t0,0\t0,0\t0,0',
    '3-Wednesday\t18\t0,1\t0,0\t0,1\t0,0\t0,0\t0,0\t0,1\t0,2\t1,3\t4,1\t16,0\t12,6\t10,5\t9,9\t9,6\t9,1\t9,1\t8,0\t6,2\t2,3\t0,6\t0,3\t0,1\t0,1\t0,0\t0,0\t0,0',
    '4-Thursday\t16\t0,0\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t1,0\t4,0\t14,1\t12,7\t10,1\t10,1\t9,9\t9,9\t9,9\t8,3\t6,5\t2,4\t0,4\t0,3\t0,1\t0,1\t0,0\t0,0\t0,0',
    '5-Friday\t16\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,1\t1,3\t4,0\t15,7\t13,1\t10,9\t9,4\t9,7\t10,2\t9,1\t7,3\t6,0\t1,9\t0,4\t0,4\t0,2\t0,1\t0,0\t0,0\t0,0',
    '6-Saturday\t10\t0,0\t0,1\t0,1\t0,1\t0,1\t0,0\t0,1\t0,1\t0,5\t2,9\t14,9\t13,9\t9,5\t10,4\t8,9\t9,9\t9,7\t8,6\t5,6\t3,8\t0,6\t0,2\t0,2\t0,1\t0,0\t0,0\t0,0',
    '7-Sunday\t4\t0,1\t0,1\t0,1\t0,0\t0,0\t0,1\t0,1\t0,1\t0,8\t0,9\t3,2\t13,8\t10,6\t14,7\t10,6\t10,9\t12,1\t10,0\t8,5\t1,7\t0,6\t0,3\t0,3\t0,1\t0,0\t0,0\t0,0'
  ],
  'Japan': [
    '1-Monday\t15\t0,1\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,2\t2,0\t9,8\t10,3\t11,0\t9,7\t9,4\t8,9\t9,7\t8,7\t9,8\t7,4\t1,7\t0,3\t0,3\t0,4\t0,0\t0,0\t0,0',
    '2-Tuesday\t15\t0,1\t0,0\t0,0\t0,0\t0,1\t0,0\t0,0\t0,1\t0,7\t2,0\t10,2\t11,4\t9,5\t9,8\t9,7\t8,9\t9,4\t9,5\t8,4\t7,3\t1,7\t0,4\t0,4\t0,3\t0,0\t0,0\t0,0',
    '3-Wednesday\t14\t0,2\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t0,1\t0,7\t2,3\t9,4\t10,3\t10,2\t8,5\t9,1\t9,0\t11,7\t10,0\t9,1\t6,5\t1,5\t0,4\t0,4\t0,2\t0,0\t0,0\t0,0',
    '4-Thursday\t15\t0,1\t0,2\t0,0\t0,0\t0,0\t0,0\t0,0\t0,2\t0,3\t2,5\t10,2\t10,5\t10,2\t9,3\t10,2\t9,0\t10,3\t8,3\t8,9\t7,3\t1,2\t0,7\t0,3\t0,1\t0,0\t0,0\t0,0',
    '5-Friday\t15\t0,1\t0,0\t0,1\t0,0\t0,1\t0,0\t0,0\t0,1\t0,7\t1,7\t12,2\t10,3\t9,9\t9,1\t9,8\t8,5\t9,3\t9,5\t8,5\t7,4\t1,6\t0,7\t0,4\t0,1\t0,0\t0,0\t0,0',
    '6-Saturday\t13\t0,1\t0,1\t0,0\t0,0\t0,0\t0,0\t0,0\t0,3\t0,4\t2,5\t12,1\t10,7\t9,6\t10,0\t9,2\t9,6\t9,6\t8,8\t8,1\t6,5\t1,5\t0,5\t0,2\t0,3\t0,0\t0,0\t0,0',
    '7-Sunday\t13\t0,2\t0,0\t0,0\t0,0\t0,0\t0,1\t0,0\t0,1\t0,2\t1,7\t9,8\t12,0\t10,1\t10,0\t8,3\t10,6\t9,9\t9,1\t7,7\t7,1\t1,7\t0,7\t0,2\t0,2\t0,0\t0,0\t0,0'
  ],
  'South Korea': [
    '1-Monday\t18\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,6\t4,2\t18,7\t13,0\t9,4\t10,6\t8,9\t8,5\t8,1\t8,3\t5,8\t2,9\t0,3\t0,3\t0,1\t0,0\t0,0\t0,0\t0,0',
    '2-Tuesday\t15\t0,2\t0,0\t0,0\t0,0\t0,1\t0,0\t0,0\t0,1\t0,3\t2,9\t13,4\t11,3\t9,9\t11,0\t10,4\t10,6\t9,4\t8,7\t6,3\t4,4\t0,8\t0,2\t0,1\t0,1\t0,0\t0,0\t0,0',
    '3-Wednesday\t15\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,1\t0,5\t3,2\t15,4\t11,2\t9,8\t10,0\t10,0\t9,7\t9,5\t8,3\t7,0\t4,1\t0,7\t0,2\t0,1\t0,1\t0,0\t0,0\t0,0',
    '4-Thursday\t16\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,3\t2,8\t13,9\t12,3\t10,2\t9,3\t10,6\t9,6\t10,2\t8,9\t7,0\t3,9\t0,5\t0,1\t0,2\t0,1\t0,0\t0,0\t0,0',
    '5-Friday\t16\t0,1\t0,0\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,4\t2,6\t13,6\t11,2\t9,9\t10,8\t11,0\t9,9\t9,7\t7,9\t6,3\t4,4\t1,3\t0,3\t0,2\t0,1\t0,0\t0,0\t0,0',
    '6-Saturday\t11\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,1\t0,4\t1,4\t11,3\t11,8\t10,9\t10,6\t9,9\t9,5\t10,5\t8,4\t6,7\t6,0\t2,0\t0,2\t0,0\t0,1\t0,0\t0,0\t0,0',
    '7-Sunday\t10\t0,1\t0,0\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,2\t0,8\t11,1\t11,2\t9,9\t9,9\t10,6\t11,7\t10,1\t9,7\t7,5\t5,0\t1,6\t0,2\t0,1\t0,2\t0,0\t0,0\t0,0'
  ],
  'SEAO': [
    '1-Monday\t18\t0,0\t0,0\t0,0\t0,1\t0,0\t0,1\t1,3\t4,6\t9,4\t5,2\t8,0\t11,7\t10,0\t11,1\t9,2\t6,5\t6,7\t4,9\t3,5\t3,1\t2,3\t1,9\t0,4\t0,0\t0,0\t0,0\t0,0',
    '2-Tuesday\t15\t0,1\t0,0\t0,0\t0,0\t0,0\t0,2\t1,3\t4,8\t10,5\t5,1\t7,2\t12,1\t10,5\t8,0\t9,6\t7,7\t6,3\t5,1\t3,1\t3,6\t2,5\t1,7\t0,6\t0,0\t0,0\t0,0\t0,0',
    '3-Wednesday\t15\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t1,0\t2,9\t7,6\t4,9\t7,7\t12,4\t10,5\t10,8\t10,6\t7,3\t6,1\t4,3\t4,0\t4,9\t3,4\t1,4\t0,2\t0,0\t0,0\t0,0\t0,0',
    '4-Thursday\t14\t0,1\t0,0\t0,0\t0,0\t0,0\t0,2\t0,9\t4,7\t8,0\t8,3\t7,6\t8,8\t10,9\t10,4\t8,6\t7,9\t6,8\t5,5\t3,4\t3,2\t2,0\t2,1\t0,8\t0,0\t0,0\t0,0\t0,0',
    '5-Friday\t15\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t1,8\t4,1\t7,2\t6,6\t7,0\t11,2\t11,6\t9,8\t9,2\t6,8\t6,9\t4,9\t4,8\t3,7\t2,4\t1,0\t0,7\t0,2\t0,0\t0,0\t0,0',
    '6-Saturday\t13\t0,0\t0,0\t0,0\t0,1\t0,0\t0,2\t0,7\t3,3\t6,8\t8,5\t7,2\t10,8\t11,7\t8,8\t9,8\t7,5\t8,0\t5,8\t3,8\t3,2\t1,6\t1,4\t0,6\t0,0\t0,0\t0,0\t0,0',
    '7-Sunday\t10\t0,0\t0,0\t0,0\t0,2\t0,0\t0,0\t0,2\t3,5\t5,0\t7,8\t8,0\t8,3\t9,2\t7,8\t12,2\t10,1\t5,4\t3,2\t6,0\t8,0\t3,6\t1,5\t0,0\t0,2\t0,0\t0,0\t0,0'
  ]
};

/* ===== Init store slots ===== */
function ensureForecastInStore(){
  const S = ROMAN.store;
  if(!S.forecast) S.forecast = {};
  const F = S.forecast;
  if(!F.totals) F.totals = JSON.parse(JSON.stringify(DEFAULT_TOTALS));
  if(!F.taskSplit) F.taskSplit = JSON.parse(JSON.stringify(DEFAULT_TASK_SPLIT));
  if(!F.weekly) F.weekly = JSON.parse(JSON.stringify(WEEKLY));
  if(!F.hourly){
    F.hourly = {};
    for(const r of REGIONS) F.hourly[r] = HOURLY[r].slice();
  }
}

/* ===== UI builders ===== */
function buildTotals(){
  const F = ROMAN.store.forecast;
  const tbody = document.querySelector('#fcRegionTotals tbody'); if(!tbody) return;
  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();
  for(const r of REGIONS){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r}</td>
      <td><input class="input mono" data-fc="total" data-region="${r}" value="${F.totals[r]}"/></td>
      <td class="mono" id="fcTaskSum-${r}"></td>
    `;
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

function buildTaskSplit(){
  const F = ROMAN.store.forecast;
  const head = document.getElementById('fcTaskSplitHead');
  const body = document.getElementById('fcTaskSplitBody');
  if(!head || !body) return;
  head.innerHTML = '<th>Region</th>' + TASKS.map(t=>`<th>${t}</th>`).join('') + '<th class="mono">Row total</th>';
  body.innerHTML = '';
  const frag = document.createDocumentFragment();
  for(const r of REGIONS){
    const vals = F.taskSplit[r];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r}</td>` + vals.map((v,i)=>`
      <td><input class="input mono" data-fc="task" data-region="${r}" data-task="${TASKS[i]}" value="${String(v).replace('.',',')}"/></td>
    `).join('') + `<td class="mono" id="fcTaskRow-${r}"></td>`;
    frag.appendChild(tr);
  }
  body.appendChild(frag);
}

function buildWeekly(){
  const F = ROMAN.store.forecast;
  const head = document.getElementById('fcWeeklyHead');
  const body = document.getElementById('fcWeeklyBody');
  if(!head || !body) return;
  head.innerHTML = '<th>Week</th>' + REGIONS.map(r=>`<th>${r}</th>`).join('') + '<th class="mono">Row total</th>';
  body.innerHTML = '';
  const frag = document.createDocumentFragment();
  for(let i=1;i<=52;i++){
    const w = 'w'+String(i).padStart(2,'0');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${w}</td>` + REGIONS.map((r,idx)=>{
      const k = REGION_KEYS[idx];
      const def = ROMAN.store.forecast.weekly[k][i-1];
      return `<td><input class="input mono" data-fc="weekly" data-week="${w}" data-region="${r}" value="${def}"/></td>`;
    }).join('') + `<td class="mono" id="fcWeeklyRow-${w}"></td>`;
    frag.appendChild(tr);
  }
  body.appendChild(frag);
}

function buildHourly(){
  const F = ROMAN.store.forecast;
  const host = document.getElementById('fcHourlyBlocks'); if(!host) return;
  host.innerHTML = '';
  for(const r of REGIONS){
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<h4 style="margin:0 0 8px 0">${r}</h4>
      <div class="scroll" style="max-height:420px">
        <table class="sticky-left">
          <thead><tr><th>Day</th><th>Total day %</th>${HOURS.map(h=>`<th>${h}</th>`).join('')}<th class="mono">Row total</th></tr></thead>
          <tbody id="fcHourlyBody-${r}"></tbody>
        </table>
      </div>`;
    host.appendChild(card);

    const tbody = card.querySelector('tbody');
    const rows = F.hourly[r];
    const frag = document.createDocumentFragment();
    for(const raw of rows){
      const parts = raw.split('\t');
      const dayLabel = parts[0];
      const dayShare = parts[1];
      const hourVals = parts.slice(2);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${dayLabel}</td>
        <td><input class="input mono" data-fc="dayShare" data-region="${r}" data-day="${dayLabel}" value="${dayShare}"/></td>` +
        hourVals.map((v,idx)=>`<td><input class="input mono" data-fc="hourPct" data-region="${r}" data-day="${dayLabel}" data-idx="${idx}" value="${v}"/></td>`).join('') +
        `<td class="mono" id="fcHourlyRow-${r}-${dayLabel}"></td>`;
      frag.appendChild(tr);
    }
    tbody.appendChild(frag);
  }
}

/* ===== Recalculations / validation ===== */
function recalcTaskRows(){
  let allOk = true;
  for(const r of REGIONS){
    const inputs = document.querySelectorAll(`input[data-fc="task"][data-region="${r}"]`);
    let s = 0; inputs.forEach(i=> s += pctToNumber(i.value));
    const cell = document.getElementById(`fcTaskRow-${r}`);
    setBadge(cell, s, 0.1);
    const mirror = document.getElementById(`fcTaskSum-${r}`);
    if(mirror) mirror.innerHTML = cell.innerHTML;
    allOk = allOk && Math.abs(s-100)<=0.1;
  }
  const el = document.getElementById('fcTaskAllOk');
  if(el){
    el.className = 'badge ' + (allOk?'ok':'warn');
    el.textContent = allOk ? 'Tasks rows = 100% ✅' : 'Some rows ≠ 100%';
  }
  return allOk;
}

function recalcWeeklyRows(){
  let ok = true;
  for(let i=1;i<=52;i++){
    const w = 'w'+String(i).padStart(2,'0');
    const inputs = document.querySelectorAll(`input[data-fc="weekly"][data-week="${w}"]`);
    let s = 0; inputs.forEach(inp=> s += pctToNumber(inp.value));
    const cell = document.getElementById(`fcWeeklyRow-${w}`);
    const diff = Math.abs(s-100);
    const klass = (diff<=0.5)?'ok':(s>100?'err':'warn');
    cell.innerHTML = `<span class="badge ${klass}">${s.toFixed(2)}%</span>`;
    ok = ok && diff<=0.5;
  }
  const el = document.getElementById('fcWeeklyOk');
  if(el){
    el.className = 'badge ' + (ok?'ok':'warn');
    el.textContent = ok ? 'Weekly rows ~100% ✅' : 'Some weeks off 100%';
  }
  return ok;
}

function recalcHourly(){
  const summaries = [];
  for(const r of REGIONS){
    let daySum = 0;
    for(const d of DAYS){
      const hoursInputs = document.querySelectorAll(`input[data-fc="hourPct"][data-region="${r}"][data-day="${d}"]`);
      let s = 0; hoursInputs.forEach(i=> s += pctToNumber(i.value));
      const cell = document.getElementById(`fcHourlyRow-${r}-${d}`);
      setBadge(cell, s, 0.5);
      const shareInp = document.querySelector(`input[data-fc="dayShare"][data-region="${r}"][data-day="${d}"]`);
      daySum += pctToNumber(shareInp.value);
    }
    summaries.push(`${r}: day-shares ${daySum.toFixed(1)}%`);
  }
  return summaries.join(' | ');
}

/* ===== Write-backs to store on edit ===== */
function wireInputs(){
  const F = ROMAN.store.forecast;

  // Totals
  document.querySelectorAll('input[data-fc="total"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const r = inp.dataset.region;
      F.totals[r] = num(inp.value);
    });
  });

  // Task split
  document.querySelectorAll('input[data-fc="task"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const r = inp.dataset.region;
      const tName = inp.dataset.task;
      const idx = TASKS.indexOf(tName);
      if(idx>=0){
        F.taskSplit[r][idx] = inp.value; // garde la virgule française si présente
        recalcTaskRows();
      }
    });
  });

  // Weekly
  document.querySelectorAll('input[data-fc="weekly"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const r = inp.dataset.region;
      const w = inp.dataset.week; // w01..w52
      const weekIdx = Math.max(0, Math.min(51, parseInt(w.slice(1),10)-1));
      const key = REGION_KEYS[REGIONS.indexOf(r)];
      F.weekly[key][weekIdx] = inp.value;
      recalcWeeklyRows();
    });
  });

  // Hourly: dayShare + hourPct
  document.querySelectorAll('input[data-fc="dayShare"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const r = inp.dataset.region;
      const day = inp.dataset.day;
      const body = document.querySelector(`#fcHourlyBody-${r}`);
      if(!body) return;
      // réécrire la ligne dans F.hourly[r]
      const rows = F.hourly[r];
      const idx = rows.findIndex(x=> x.startsWith(day+'\t'));
      if(idx>=0){
        const parts = rows[idx].split('\t');
        parts[1] = inp.value;
        rows[idx] = parts.join('\t');
      }
      const msg = recalcHourly();
      const el = document.getElementById('fcSummary'); if(el){ el.textContent = msg; el.className='badge'; }
    });
  });

  document.querySelectorAll('input[data-fc="hourPct"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const r = inp.dataset.region;
      const day = inp.dataset.day;
      const col = parseInt(inp.dataset.idx,10);
      const rows = F.hourly[r];
      const idx = rows.findIndex(x=> x.startsWith(day+'\t'));
      if(idx>=0){
        const parts = rows[idx].split('\t');
        // 0 = day, 1 = dayShare, heures commencent à 2 => +2
        parts[2+col] = inp.value;
        rows[idx] = parts.join('\t');
      }
      const msg = recalcHourly();
      const el = document.getElementById('fcSummary'); if(el){ el.textContent = msg; el.className='badge'; }
    });
  });
}

/* ===== Reset + Paint ===== */
function resetDefaults(){
  const F = ROMAN.store.forecast;
  F.totals = JSON.parse(JSON.stringify(DEFAULT_TOTALS));
  F.taskSplit = JSON.parse(JSON.stringify(DEFAULT_TASK_SPLIT));
  F.weekly = JSON.parse(JSON.stringify(WEEKLY));
  F.hourly = {};
  for(const r of REGIONS) F.hourly[r] = HOURLY[r].slice();
  paint();
}

function paint(){
  ensureForecastInStore();
  buildTotals();
  buildTaskSplit();
  buildWeekly();
  buildHourly();
  wireInputs();
  recalcTaskRows();
  recalcWeeklyRows();
  const msg = recalcHourly();
  const el = document.getElementById('fcSummary'); if(el){ el.textContent = msg; el.className='badge'; }
}

/* ===== Public ===== */
export function initForecast(){
  ensureForecastInStore();
  // Boutons
  document.getElementById('fcValidate')?.addEventListener('click', ()=>{
    const a = recalcTaskRows();
    const b = recalcWeeklyRows();
    const c = recalcHourly();
    const badge = document.getElementById('fcSummary');
    if(badge){
      badge.textContent = `Tasks=${a?'OK':'Check'} | Weekly=${b?'OK':'Check'} | ${c}`;
      badge.className = 'badge ' + ((a&&b)?'ok':'warn');
    }
  });
  document.getElementById('fcReset')?.addEventListener('click', resetDefaults);

  // Premier rendu
  paint();
}
