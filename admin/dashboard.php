<?php
declare(strict_types=1);
require_once __DIR__ . '/common.php';

$stats = [
    'products' => (int) adminQuery('SELECT COUNT(*) AS n FROM products')->fetch_assoc()['n'],
    'orders' => (int) adminQuery("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'")->fetch_assoc()['n'],
    'reviews' => (int) adminQuery('SELECT COUNT(*) AS n FROM reviews')->fetch_assoc()['n'],
    'messages' => (int) adminQuery('SELECT COUNT(*) AS n FROM contact_messages')->fetch_assoc()['n'],
];
$reviews = adminQuery('SELECT name, rating, text FROM reviews ORDER BY created_at DESC LIMIT 5')->fetch_all(MYSQLI_ASSOC);
$orders = adminQuery('SELECT id, full_name, phone, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5')->fetch_all(MYSQLI_ASSOC);
$messages = adminQuery('SELECT name, message, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5')->fetch_all(MYSQLI_ASSOC);
$popular = adminQuery('SELECT id, name, price, image FROM products WHERE is_popular = 1 ORDER BY created_at DESC, id DESC LIMIT 5')->fetch_all(MYSQLI_ASSOC);

$chartLabels = [];
$chartData = [];
for ($daysAgo = 6; $daysAgo >= 0; $daysAgo--) {
    $date = new DateTimeImmutable('today -' . $daysAgo . ' days');
    $start = $date->format('Y-m-d 00:00:00');
    $end = $date->modify('+1 day')->format('Y-m-d 00:00:00');
    $count = adminQuery('SELECT COUNT(*) AS n FROM orders WHERE created_at >= ? AND created_at < ?', 'ss', [$start, $end])->fetch_assoc();
    $chartLabels[] = $date->format('M d');
    $chartData[] = (int) $count['n'];
}
$maxChart = max(1, ...$chartData);
$initial = static fn (string $name): string => mb_strtoupper(mb_substr(trim($name), 0, 1));
$imageUrl = static fn (?string $image): string => $image ? 'image.php?file=' . rawurlencode(basename($image)) : '';
$statusClass = static fn (string $status): string => [
    'new' => 'bg-orange-50 text-orange-600 border-orange-100',
    'confirmed' => 'bg-blue-50 text-blue-600 border-blue-100',
    'ready' => 'bg-yellow-50 text-yellow-600 border-yellow-100',
    'delivered' => 'bg-green-50 text-green-600 border-green-100',
    'cancelled' => 'bg-red-50 text-red-600 border-red-100',
][$status] ?? 'bg-gray-50 text-gray-400 border-gray-100';

adminHeader('Գլխավոր', 'dashboard');
?>
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <div class="relative overflow-hidden group bg-gradient-to-br from-[#111827] to-[#1F2937] rounded-none p-6 text-white shadow-xl shadow-gray-900/10 hover:shadow-gray-900/20 transition-all duration-300 border border-white/5">
        <div class="absolute -right-4 -top-4 opacity-10 text-primary text-[120px]">◇</div><div class="relative z-10">
            <div class="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary"><?= adminIcon('products') ?></div>
            <h3 class="text-4xl font-heading font-normal mb-1 tabular-nums text-primary"><?= $stats['products'] ?></h3><p class="text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase">Ընդհանուր Տեսականի</p>
            <a href="index.php" class="inline-flex items-center gap-2 mt-4 text-[10px] font-bold border border-primary/30 text-primary hover:bg-primary hover:text-luxe-black px-4 py-2 transition-all uppercase tracking-widest">Կառավարել →</a>
        </div>
    </div>
    <?php foreach ([['orders', 'Նոր Պատվերներ', 'content.php?view=orders', 'Դիտել'], ['reviews', 'Կարծիքներ', 'content.php?view=reviews', 'Դիտել'], ['messages', 'Կապի Հաղորդագրություն', 'content.php?view=messages', 'Կարդալ']] as [$key, $label, $href, $cta]): ?>
        <div class="relative overflow-hidden group bg-white rounded-none p-6 text-gray-900 shadow-xl shadow-gray-100 hover:shadow-gray-200 transition-all duration-300 border border-gray-100">
            <div class="absolute -right-4 -top-4 opacity-5 text-[120px]">◇</div><div class="relative z-10">
                <div class="w-12 h-12 bg-gray-50 border border-gray-100 flex items-center justify-center mb-4 text-primary"><?= adminIcon($key === 'orders' ? 'orders' : $key) ?></div>
                <h3 class="text-4xl font-heading font-normal mb-1 tabular-nums"><?= $stats[$key] ?></h3><p class="text-gray-400 text-[10px] font-bold tracking-[0.2em] uppercase"><?= escape($label) ?></p>
                <a href="<?= escape($href) ?>" class="inline-flex items-center gap-2 mt-4 text-[10px] font-bold border border-gray-200 text-gray-900 hover:bg-gray-900 hover:text-white px-4 py-2 transition-all uppercase tracking-widest"><?= escape($cta) ?> →</a>
            </div>
        </div>
    <?php endforeach; ?>
</div>

<div class="bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden mb-8">
    <div class="p-8 border-b border-gray-50 bg-gray-50/50"><h3 class="text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Պատվերների վիճակագրություն</h3><p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Վերջին 7 օրեր</p></div>
    <div class="p-8"><div class="relative h-64 sm:h-96 flex items-end gap-3 pb-8">
        <?php foreach ($chartData as $index => $value): ?><div class="flex-1 flex flex-col items-center justify-end gap-2 h-full"><span class="text-[10px] font-bold text-gray-400"><?= $value ?></span><div class="w-full bg-primary/80" style="height: <?= max(4, ($value / $maxChart) * 100) ?>%"></div><span class="text-[9px] font-bold text-gray-400 uppercase"><?= escape($chartLabels[$index]) ?></span></div><?php endforeach; ?>
    </div></div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div class="lg:col-span-2 bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div class="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50"><div><h3 class="text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Վերջին կարծիքները</h3><p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Հաճախորդների հետադարձ կապ</p></div><a href="content.php?view=reviews" class="px-6 py-2 border border-gray-200 hover:bg-gray-900 hover:text-white text-[10px] uppercase tracking-widest font-bold transition-all">Բոլորը</a></div>
        <div class="p-8 space-y-6"><?php foreach ($reviews as $review): ?><div class="flex items-start gap-5 p-4 hover:bg-gray-50 transition-all"><div class="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-heading text-2xl"><?= escape($initial((string) $review['name'])) ?></div><div class="flex-1 min-w-0"><div class="flex items-center justify-between mb-2"><h4 class="font-bold text-gray-900 text-sm uppercase tracking-wide"><?= escape((string) $review['name']) ?></h4><div class="text-primary"><?= str_repeat('★', max(0, min(5, (int) $review['rating']))) ?></div></div><p class="text-gray-500 text-sm leading-relaxed font-light"><?= escape((string) $review['text']) ?></p></div></div><?php endforeach; ?><?php if (!$reviews): ?><div class="text-center py-10 text-gray-400 italic">Կարծիքներ չկան</div><?php endif; ?></div>
    </div>
    <div class="bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden"><div class="p-8 border-b border-gray-50 bg-gray-50/50"><h3 class="text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Հանրաճանաչ Զարդեր</h3><p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Լավագույն վաճառքներ</p></div><div class="p-6 space-y-4">
        <?php foreach ($popular as $item): ?><a href="edit.php?id=<?= (int) $item['id'] ?>" class="flex items-center gap-4 p-3 hover:bg-gray-50 transition-all group"><div class="w-16 h-16 overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0"><?php if ($item['image']): ?><img src="<?= escape($imageUrl((string) $item['image'])) ?>" alt="" class="w-full h-full object-cover"><?php else: ?><div class="w-full h-full flex items-center justify-center text-xl">💎</div><?php endif; ?></div><div class="flex-1 min-w-0"><h4 class="font-bold text-gray-900 text-[13px] uppercase tracking-wide truncate"><?= escape((string) $item['name']) ?></h4><p class="text-primary font-black text-xs mt-1"><?= number_format((float) $item['price']) ?> AMD</p></div><span class="text-gray-300 text-xl">›</span></a><?php endforeach; ?>
        <?php if (!$popular): ?><p class="text-gray-400 text-center py-10 italic">Տվյալներ չկան</p><?php endif; ?><a href="index.php" class="block w-full text-center py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 hover:text-primary border-t border-gray-50 mt-4">Տեսնել ամբողջ տեսականին</a>
    </div></div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
    <div class="lg:col-span-2 bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden"><div class="p-5 md:p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50"><div><h3 class="text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Վերջին Պատվերները</h3><p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Նոր պատվերներ</p></div><a href="content.php?view=orders" class="px-6 py-2 border border-gray-200 hover:bg-gray-900 hover:text-white text-[10px] uppercase tracking-widest font-bold transition-all">Բոլորը</a></div><div class="p-5 md:p-8 overflow-x-auto"><table class="w-full text-left min-w-[600px]"><thead><tr class="text-[10px] uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100"><th class="pb-4">ID</th><th class="pb-4">Հաճախորդ</th><th class="pb-4">Գումար</th><th class="pb-4">Կարգավիճակ</th><th class="pb-4">Ամսաթիվ</th></tr></thead><tbody><?php foreach ($orders as $order): ?><tr class="border-b border-gray-50 hover:bg-gray-50/50"><td class="py-5 font-bold">#<?= (int) $order['id'] ?></td><td class="py-5"><span class="uppercase tracking-wide"><?= escape((string) $order['full_name']) ?></span><br><span class="text-[11px] text-gray-400"><?= escape((string) $order['phone']) ?></span></td><td class="py-5 font-black text-primary"><?= number_format((float) $order['total']) ?> AMD</td><td class="py-5"><span class="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border <?= $statusClass((string) $order['status']) ?>"><?= escape(statusLabel((string) $order['status'])) ?></span></td><td class="py-5 text-gray-500 text-sm"><?= escape((string) $order['created_at']) ?></td></tr><?php endforeach; ?><?php if (!$orders): ?><tr><td colspan="5" class="py-12 text-center text-gray-400 italic">Պատվերներ չկան</td></tr><?php endif; ?></tbody></table></div></div>
    <div class="bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden"><div class="p-5 md:p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50"><div><h3 class="text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Հաղորդագրություններ</h3><p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Կապ մեզ հետ</p></div><a href="content.php?view=messages" class="px-4 py-2 border border-gray-200 hover:bg-gray-900 hover:text-white text-[10px] uppercase tracking-widest font-bold transition-all">Բոլորը</a></div><div class="p-5 md:p-6 space-y-4"><?php foreach ($messages as $message): ?><div class="p-5 hover:bg-gray-50 border border-gray-100"><div class="flex items-center justify-between mb-3"><h4 class="font-bold text-gray-900 text-[11px] uppercase tracking-widest"><?= escape((string) $message['name']) ?></h4><span class="text-[9px] text-gray-400"><?= escape(substr((string) $message['created_at'], 0, 10)) ?></span></div><p class="text-[11px] font-bold text-primary mb-2 uppercase tracking-wide">Կապի հաղորդագրություն</p><p class="text-gray-500 text-xs leading-relaxed"><?= escape((string) $message['message']) ?></p></div><?php endforeach; ?><?php if (!$messages): ?><div class="py-10 text-center text-gray-400 italic">Հաղորդագրություններ չկան</div><?php endif; ?></div></div>
</div>
<?php adminFooter(); ?>
