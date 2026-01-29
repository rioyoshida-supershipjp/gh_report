const { execSync } = require('child_process');
const fs = require('fs');

const STATUS_JA = {
    "Backlog": "未着手",
    "Issues": "着手可能",
    "In Progress": "進行中",
    "InTeamReview": "チームレビュー中",
    "InReview": "レビュー中",
    "Done": "完了"
}

const USERS = {
    "rioyoshida-supershipjp": "吉田里央",
    "kiyofumiasada-supershipjp": "浅田清文",
    "ryotatanaka-supershipjp": "田中亮太",
    "yutakawakami-supership": "川上裕太",
}

const drawLine = () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

const isDraw = (item)=> {
    // In Progress は無条件で表示
    if (item.status === 'In Progress') {
        return true; // 表示する
    }
    
    // In Progress 以外は、今日更新されていなければ表示しない
    if (!item.isUpdatedToday) {
        return false; // 表示しない
    }

    // Backlog, Issuesに関しては、更新日が今日でも、今日作業したことにはならない
    if (['Backlog', 'Issues'].includes(item.status)) {
        return false; // 表示しない
    }

    return true; // 表示する
}

// GraphQL クエリで更新日時を含む情報を取得
const query = `{
    organization(login: "supership-jp") {
        projectV2(number: 155) {
            items(first: 100) {
                nodes {
                    id
                    content {
                        ... on Issue {
                            number
                            title
                            url
                            createdAt
                            updatedAt
                            assignees(first: 10) {
                                nodes {
                                    login
                                }
                            }
                            labels(first: 10) {
                                nodes {
                                    name
                                }
                            }
                        }
                    }
                    fieldValues(first: 20) {
                        nodes {
                            ... on ProjectV2ItemFieldSingleSelectValue {
                                name
                                field {
                                    ... on ProjectV2FieldCommon {
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}`;

// gh api コマンドで GraphQL を実行
const result = execSync(`gh api graphql -f query='${query.replace(/'/g, "'\"'\"'")}'`, {
    encoding: 'utf-8'
});
const data = JSON.parse(result);
const items = data.data.organization.projectV2.items.nodes;

const drawItems = {};
const debugItems = {};
items.forEach((item, index) => {
    if (!item.content) return;

    // ステータスを取得
    const statusField = item.fieldValues.nodes.find(
        field => field.field && field.field.name === 'Status'
    );
    const status = statusField ? statusField.name : '未設定';

    // 担当者を取得
    const assignees = item.content.assignees?.nodes.map(a => a.login) || [];

    // ラベルを取得
    item.labels = item.content.labels?.nodes.map(l => l.name) || [];

    // 日付をフォーマット
    const createdAt = new Date(item.content.createdAt).toLocaleString('ja-JP');
    const updatedAt = new Date(item.content.updatedAt).toLocaleString('ja-JP');
    
    // 今日かどうかを判定
    const updatedDate = new Date(item.content.updatedAt);
    const today = new Date();
    const isUpdatedToday = 
        updatedDate.getFullYear() === today.getFullYear() &&
        updatedDate.getMonth() === today.getMonth() &&
        updatedDate.getDate() === today.getDate();

    if (assignees.length == 0) return;

    const phase = item.labels[0];
    item.status = status;
    item.isUpdatedToday = isUpdatedToday;

    if (!phase) return;
    if (!isDraw(item)) return;

    drawItems[phase] ||= [];
    drawItems[phase].push(item);

    assignees.forEach(assignee => {
        debugItems[assignee] ||= [];
        debugItems[assignee].push(item);
    });
});

Object.entries(drawItems).forEach(([phase, items]) => {
    console.log(`・${phase}`);
    items.forEach((item) => {
        console.log(`  ・ ${item.content.title}`);
        console.log(`    ・${STATUS_JA[item.status]}`);
    });
});

drawLine();

console.log("※ 以下デバッグ用");

Object.entries(debugItems).forEach(([assignee, items]) => {
    console.log(`・${USERS[assignee] || assignee}`);
    items.forEach((item) => {
        console.log(`  ・ ${item.content.title}`);
        console.log(`    ・${STATUS_JA[item.status]}`);
    });
});

fs.writeFileSync('project-data.json', JSON.stringify(items, null, 2));