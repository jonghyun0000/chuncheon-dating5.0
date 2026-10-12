const copies = {
  ko: {
    encourage:'사진으로 우리 팀의 매력을 보여주세요! 매칭에 도움이 될 수 있어요.',add:'사진 추가',change:'사진 변경하기',removeHint:'사진 변경·삭제는 아래 팀 저장 버튼을 눌러야 반영됩니다.',pending:'선택한 사진은 마지막 동의 후 팀 저장 시 업로드됩니다.',consentError:'사진을 등록하려면 아래 사진 공개·보관 동의를 확인해주세요.',
    title:'팀원 사진 · 선택 1장',
    notice:'팀 공개 후 다른 회원이 볼 수 있습니다. 팀 삭제 후에는 관리자만 90일간 문의 대응 목적으로 보관합니다. 사진 교체·삭제 또는 탈퇴 시 공개를 중단하고 24시간 이내 삭제 처리합니다.',
    consent:'사진 속 당사자의 공개·보관 동의를 받았습니다. 동의하지 않아도 사진 없이 이용할 수 있습니다.',
    choose:'사진 선택',hint:'JPG·PNG·WebP, 최대 10MB · 위치정보 제거 후 저장',busy:'사진 업로드 중…',remove:'사진 삭제하기',
    expand:'사진 확대',close:'닫기',loading:'사진 불러오는 중…',failed:'사진을 불러오지 못했습니다',privacy:'선택 팀원 사진 및 관리자 보관',
    details:'선택 사진은 팀원별 1장을 수집하며, 학교·학과·학번·성별·이름(없으면 닉네임)·닉네임과 연결합니다. 이름을 새로 요구하지 않습니다. 일반 회원에게는 기존 공개 팀 정보와 사진만 보이고, 전체 학번과 보관함은 관리자만 조회합니다. 보관 동의는 팀 저장 전 마지막 동의 영역에서 별도로 받습니다. 사진 삭제 요청은 팀 수정 또는 관리자 문의로 접수할 수 있습니다.',
  },
  en: {
    encourage:'Show your team’s personality! Photos can help others decide to match.',add:'Add photo',change:'Change photo',removeHint:'Save the team below to apply photo changes or removal.',pending:'Selected photos upload only when you consent below and save the team.',consentError:'Please confirm photo display and retention consent below.',
    title:'Member photo · optional, one each',
    notice:'Visible to eligible members once the team is published. After team deletion, administrators retain it for 90 days to handle support enquiries. Replacement, photo deletion or account withdrawal stops access and schedules deletion within 24 hours.',
    consent:'I have the photographed person’s consent to display and retain this photo. Photos are optional; declining does not restrict service use.',
    choose:'Choose photo',hint:'JPG, PNG or WebP, up to 10MB · location metadata removed',busy:'Uploading photo…',remove:'Delete photo',
    expand:'Enlarge photo',close:'Close',loading:'Loading photo…',failed:'Could not load photo',privacy:'Optional member photos and administrator archive',
    details:'One optional photo per member is linked to school, department, student number, gender, name (nickname if unavailable), and nickname. No additional real name is required. Other members see only the existing public team details and photo; full student numbers and the archive are administrator-only. Separate consent is requested before saving the team. Request photo deletion by editing the team or contacting the administrator.',
  },
  ja: {
    encourage:'写真でチームの魅力を伝えましょう！マッチングの参考になります。',add:'写真を追加',change:'写真を変更',removeHint:'変更・削除は下のチーム保存ボタンで反映されます。',pending:'写真は最後の同意を確認し、チームを保存する時にアップロードされます。',consentError:'写真の公開・保管への同意を確認してください。',
    title:'メンバー写真・任意で1人1枚',
    notice:'チーム公開後、閲覧権限のある会員に表示されます。チーム削除後は問い合わせ対応のため管理者のみ90日間保管します。写真の差し替え・削除、退会時には公開を停止し、24時間以内に削除処理します。',
    consent:'写っている本人から公開・保管の同意を得ています。写真は任意で、同意しなくても利用できます。',
    choose:'写真を選択',hint:'JPG・PNG・WebP、10MBまで・位置情報を除去して保存',busy:'アップロード中…',remove:'写真を削除',
    expand:'写真を拡大',close:'閉じる',loading:'写真を読み込み中…',failed:'写真を読み込めませんでした',privacy:'任意のメンバー写真と管理者保管',
    details:'1人1枚の任意写真を学校・学科・学籍番号・性別・名前（なければニックネーム）・ニックネームに関連付けます。実名の追加入力は不要です。他の会員には既存の公開情報と写真のみ表示し、学籍番号全体と保管庫は管理者のみ閲覧できます。チーム保存前に別途同意を確認します。写真削除はチーム編集または管理者への問い合わせから依頼できます。',
  },
  zh: {
    encourage:'用照片展示队伍的魅力，有助于彼此了解和匹配！',add:'添加照片',change:'更换照片',removeHint:'点击下方保存队伍按钮以应用照片更改或删除。',pending:'选择的照片仅在最后同意并保存队伍时上传。',consentError:'请在下方确认照片公开及保存同意。',
    title:'队员照片 · 每人可选1张',
    notice:'队伍公开后，有查看权限的会员可见。队伍删除后，仅管理员保留90天用于处理咨询。更换、删除照片或注销时停止展示，并在24小时内处理删除。',
    consent:'我已取得照片中本人的公开及保存同意。照片为可选，不同意也可正常使用服务。',
    choose:'选择照片',hint:'JPG、PNG、WebP，最大10MB · 保存前移除位置信息',busy:'照片上传中…',remove:'删除照片',
    expand:'放大照片',close:'关闭',loading:'照片加载中…',failed:'无法加载照片',privacy:'可选队员照片及管理员保存',
    details:'每名队员可选上传1张照片，并关联学校、专业、学号、性别、姓名（没有则使用昵称）及昵称。不额外要求真实姓名。其他会员仅可查看现有公开队伍信息和照片，完整学号和存档仅限管理员查看。保存队伍前单独确认同意。可通过编辑队伍或联系管理员申请删除照片。',
  },
};
export const photoCopy = (lang: string) => copies[lang as keyof typeof copies] ?? copies.ko;
