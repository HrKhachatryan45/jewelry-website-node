<?php
declare(strict_types=1);
require_once __DIR__ . '/common.php';

$view = (string) ($_GET['view'] ?? 'orders');
$allowed = ['hero', 'orders', 'bespoke', 'reviews', 'messages', 'users'];
if (!in_array($view, $allowed, true)) {
    http_response_code(404);
    exit('Էջը չի գտնվել։');
}
if (basename((string) ($_SERVER['SCRIPT_NAME'] ?? '')) === 'content.php' && $view === 'orders' && filter_var($_GET['order'] ?? null, FILTER_VALIDATE_INT) > 0) {
    header('Location: order-detail.php?id=' . (int) $_GET['order']);
    exit;
}

function contentPager(string $view, int $page, int $total, int $size = 15): void
{
    $pages = max(1, (int) ceil($total / $size));
    if ($pages < 2) return;
    echo '<div class="flex gap-2 mt-6">';
    for ($i = 1; $i <= $pages; $i++) {
        echo '<a class="admin-button ' . ($i === $page ? 'dark' : '') . '" href="content.php?view=' . escape($view) . '&page=' . $i . '">' . $i . '</a>';
    }
    echo '</div>';
}

adminHeader(match ($view) {
    'hero' => 'Գլխ. նկարներ',
    'orders' => 'Պատվերներ',
    'bespoke' => 'Անհատական պատվերներ',
    'reviews' => 'Կարծիքներ',
    'messages' => 'Կապ',
    'users' => 'Օգտատերեր',
}, $view);

if ($view === 'hero') {
    $settings = adminQuery('SELECT * FROM hero_settings WHERE id = 1 LIMIT 1')->fetch_assoc() ?: [];
    $slides = adminQuery('SELECT * FROM hero_slides ORDER BY `order`, id')->fetch_all(MYSQLI_ASSOC);
    ?>
    <div class="page-heading"><div><p class="eyebrow">ԳԼԽԱՎՈՐ ԷՋ</p><h1>Գլխ. նկարներ</h1><p class="heading-copy">Կառավարեք գլխավոր էջի տեքստն ու սլայդերը</p></div></div>
    <section class="admin-card p-6 mb-6"><h2 class="section-heading">Գլխավոր էջի տեքստ</h2>
        <form method="post" action="actions.php" class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>"><input type="hidden" name="action" value="hero_settings">
            <label><span class="admin-label">Վերնագիր</span><input class="admin-input" name="title_line1" value="<?= escape((string) ($settings['title_line1'] ?? '')) ?>"></label>
            <label><span class="admin-label">Գունավոր վերնագիր</span><input class="admin-input" name="title_highlight" value="<?= escape((string) ($settings['title_highlight'] ?? '')) ?>"></label>
            <label class="md:col-span-2"><span class="admin-label">Նկարագրություն</span><textarea class="admin-input" name="description" rows="3"><?= escape((string) ($settings['description'] ?? '')) ?></textarea></label>
            <button class="admin-button w-fit" type="submit">Պահպանել տեքստը</button>
        </form>
    </section>
    <section class="admin-card p-6"><div class="section-heading"><h2>Սլայդեր</h2><span class="heading-copy"><?= count($slides) ?> հատ</span></div>
        <form method="post" action="actions.php" enctype="multipart/form-data" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>"><input type="hidden" name="action" value="hero_slide">
            <label><span class="admin-label">Վերնագիր</span><input class="admin-input" name="title" required></label>
            <label><span class="admin-label">Հերթականություն</span><input class="admin-input" name="order" type="number" value="0"></label>
            <label><span class="admin-label">Նկար</span><input class="admin-input" name="image" type="file" accept="image/*" required></label>
            <button class="admin-button self-end" type="submit">Ավելացնել սլայդ</button>
        </form>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5"><?php foreach ($slides as $slide): ?><article class="border border-gray-100">
            <?php if (!empty($slide['image'])): ?><img class="w-full aspect-[16/9] object-cover" src="image.php?file=<?= rawurlencode('hero/' . basename((string) $slide['image'])) ?>" alt=""><?php endif; ?>
            <div class="p-4"><form method="post" action="actions.php" enctype="multipart/form-data" class="space-y-3">
                <input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>"><input type="hidden" name="action" value="hero_update"><input type="hidden" name="id" value="<?= (int) $slide['id'] ?>">
                <input class="admin-input" name="title" value="<?= escape((string) $slide['title']) ?>"><input class="admin-input" name="order" type="number" value="<?= (int) $slide['order'] ?>">
                <label class="text-[9px] text-gray-400 uppercase tracking-widest"><input type="checkbox" name="is_active" value="1" <?= $slide['is_active'] ? 'checked' : '' ?>> Ակտիվ</label>
                <input class="admin-input" name="image" type="file" accept="image/*"><button class="admin-button" type="submit">Պահպանել</button></form>
                <?= adminPost('hero_delete', ['id' => $slide['id']]) ?><button class="admin-button danger mt-4" type="submit">Ջնջել</button></form>
            </div></article><?php endforeach; ?></div>
    </section>
    <?php
} elseif ($view === 'orders') {
    $detailId = filter_var($_GET['order'] ?? null, FILTER_VALIDATE_INT);
    if ($detailId !== false && $detailId > 0) {
        $orderStatement = $mysqli->prepare('SELECT * FROM orders WHERE id = ? LIMIT 1');
        $orderStatement->bind_param('i', $detailId);
        $orderStatement->execute();
        $order = $orderStatement->get_result()->fetch_assoc();
        if (!$order) {
            http_response_code(404);
            exit('Պատվերը չի գտնվել։');
        }
        $itemStatement = $mysqli->prepare('SELECT oi.*, p.image AS product_image FROM order_items oi LEFT JOIN products p ON p.id = oi.menu_item_id WHERE oi.order_id = ? ORDER BY oi.id');
        $itemStatement->bind_param('i', $detailId);
        $itemStatement->execute();
        $items = $itemStatement->get_result()->fetch_all(MYSQLI_ASSOC);
        $statusChoices = ['new', 'confirmed', 'ready', 'delivered', 'cancelled'];
        $deliveryLabel = static fn (string $value): string => $value === 'delivery' ? 'Առաքում' : 'Սրահից';
        $paymentLabel = static fn (string $value): string => ['cash' => 'Կանխիկ', 'card' => 'Քարտ (POS)', 'idram' => 'Idram'][$value] ?? $value;
        $imageUrl = static fn (?string $image): string => $image ? 'image.php?file=' . rawurlencode(basename($image)) : '';
        $detailStatusClass = static fn (string $value): string => [
            'new' => 'bg-orange-50 text-orange-600 border-orange-100',
            'confirmed' => 'bg-blue-50 text-blue-600 border-blue-100',
            'ready' => 'bg-yellow-50 text-yellow-600 border-yellow-100',
            'delivered' => 'bg-green-50 text-green-600 border-green-100',
            'cancelled' => 'bg-red-50 text-red-600 border-red-100',
        ][$value] ?? 'bg-gray-50 text-gray-400 border-gray-100';
        $itemsTotal = (float) $order['total'] - (float) ($order['delivery_price'] ?? 0);
        ?>
        <div class="lg:hidden mb-6"><a href="content.php?view=orders" class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 hover:text-primary">← Վերադառնալ</a></div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-8">
                <div class="bg-white rounded-none border border-gray-200 shadow-sm overflow-hidden">
                    <div class="p-6 border-b border-gray-100 flex items-center justify-between"><h3 class="text-sm font-heading font-normal uppercase tracking-widest text-gray-900">Պատվիրված Զարդեր</h3><span class="px-3 py-1 bg-gray-50 text-gray-400 text-[9px] font-bold uppercase tracking-widest border border-gray-100"><?= count($items) ?> Զարդ</span></div>
                    <div class="divide-y divide-gray-50">
                        <?php foreach ($items as $item): ?><div class="p-6 hover:bg-gray-50 transition-colors"><div class="flex gap-6">
                            <div class="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 border border-gray-100 bg-gray-50 overflow-hidden"><?php if ($item['product_image']): ?><img src="<?= escape($imageUrl((string) $item['product_image'])) ?>" alt="" class="w-full h-full object-cover"><?php else: ?><span class="flex h-full items-center justify-center text-3xl text-gray-200">◇</span><?php endif; ?></div>
                            <div class="flex-1 min-w-0"><div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4"><div><h4 class="font-heading font-normal text-gray-900 text-lg sm:text-xl uppercase tracking-wide"><?= escape((string) $item['name']) ?></h4><p class="text-[9px] font-bold text-gray-300 uppercase tracking-[0.3em] mt-1.5">Քանակ՝ <?= (int) $item['quantity'] ?></p></div><div class="text-left sm:text-right"><p class="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1"><?= number_format((float) $item['price']) ?> ֏ / հատ</p><p class="text-xl font-heading font-normal text-primary"><?= number_format((float) $item['price'] * (int) $item['quantity']) ?> ֏</p></div></div>
                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3"><?php if ($item['weight'] !== null): ?><div class="p-3 bg-gray-50 border border-gray-100 text-center"><span class="block text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Քաշ</span><span class="text-[11px] font-bold text-gray-700"><?= escape((string) $item['weight']) ?> գր․</span></div><?php endif; ?><?php if ($item['material']): ?><div class="p-3 bg-primary/5 border border-primary/10 text-center"><span class="block text-[8px] font-bold text-primary uppercase tracking-widest mb-1">Մետաղ</span><span class="text-[11px] font-bold text-luxe-black uppercase"><?= escape((string) $item['material']) ?></span></div><?php endif; ?><?php if ($item['size']): ?><div class="p-3 bg-gray-50 border border-gray-100 text-center"><span class="block text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Չափս</span><span class="text-[11px] font-bold text-gray-700"><?= escape((string) $item['size']) ?></span></div><?php endif; ?></div>
                                <?php if ($item['custom_text']): ?><div class="mt-4 p-4 bg-gray-900 border-l-4 border-primary"><span class="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Փորագրություն</span><p class="text-sm font-heading text-white italic mt-2">"<?= escape((string) $item['custom_text']) ?>"</p></div><?php endif; ?><?php if ($item['note']): ?><p class="mt-4 text-gray-400 text-[11px] italic">📝 <?= escape((string) $item['note']) ?></p><?php endif; ?>
                            </div>
                        </div></div><?php endforeach; ?>
                    </div>
                    <div class="p-8 bg-gray-50 border-t border-gray-100"><p class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em]">Ապրանքներ</p><p class="text-xl font-heading text-gray-500"><?= number_format($itemsTotal) ?> ֏</p><p class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] mt-2">Առաքում</p><p class="text-xl font-heading text-gray-500"><?= number_format((float) ($order['delivery_price'] ?? 0)) ?> ֏</p><p class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] mt-4">Ընդհանուր Գումար</p><p class="text-4xl font-heading text-primary"><?= number_format((float) $order['total']) ?> <span class="text-sm text-gray-400 uppercase tracking-widest ml-1">AMD</span></p></div>
                </div>
                <?php if (!empty($order['order_note'])): ?><div class="bg-gray-900 border-l-4 border-primary p-8"><h3 class="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-4">Ծանոթագրություն</h3><p class="text-white text-lg font-heading leading-relaxed italic">"<?= escape((string) $order['order_note']) ?>"</p></div><?php endif; ?>
                <?php if ($order['delivery_type'] === 'delivery' && !empty($order['address'])): ?><div class="bg-white rounded-none border border-gray-200 shadow-sm p-8"><h3 class="text-sm font-heading uppercase tracking-widest text-gray-900 mb-6">⌖ Առաքման Հասցե</h3><p class="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-2"><?= escape((string) ($order['city'] ?? '')) ?></p><p class="text-gray-900 font-heading text-2xl leading-relaxed"><?= escape((string) $order['address']) ?></p></div><?php endif; ?>
            </div>
            <div class="space-y-8">
                <div class="bg-white rounded-none border border-gray-200 shadow-sm p-8"><h3 class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] mb-8">Հաճախորդ</h3><div class="flex items-center gap-5 mb-8"><div class="w-16 h-16 bg-gray-50 border border-gray-100 flex items-center justify-center text-primary font-heading text-3xl"><?= escape(mb_strtoupper(mb_substr((string) $order['full_name'], 0, 1))) ?></div><div><p class="font-heading text-gray-900 text-2xl uppercase tracking-tight leading-none mb-2"><?= escape((string) $order['full_name']) ?></p><a href="tel:<?= escape((string) $order['phone']) ?>" class="text-[11px] font-bold text-primary tracking-widest"><?= escape((string) $order['phone']) ?></a></div></div><div class="space-y-4 pt-8 border-t border-gray-100"><?php if ($order['email']): ?><div class="flex justify-between gap-4"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Էլ. փոստ</span><a href="mailto:<?= escape((string) $order['email']) ?>" class="text-[10px] font-bold text-gray-900 truncate"><?= escape((string) $order['email']) ?></a></div><?php endif; ?><div class="flex justify-between"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Ստացում</span><span class="text-[10px] font-bold text-gray-900 uppercase"><?= escape($deliveryLabel((string) $order['delivery_type'])) ?></span></div><div class="flex justify-between"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Վճարում</span><span class="text-[10px] font-bold text-primary uppercase"><?= escape($paymentLabel((string) $order['payment_method'])) ?></span></div><div class="flex justify-between"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Ամսաթիվ</span><span class="text-[10px] font-bold text-gray-900"><?= escape((string) $order['created_at']) ?></span></div></div></div>
                <div class="bg-white rounded-none border border-gray-200 shadow-sm p-8"><h3 class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] mb-8">Կարգավիճակ</h3><span class="inline-flex items-center px-6 py-2 text-[10px] font-bold uppercase tracking-[0.2em] border <?= $detailStatusClass((string) $order['status']) ?>"><span class="w-1.5 h-1.5 rounded-full mr-2.5 bg-current"></span><?= escape(statusLabel((string) $order['status'])) ?></span><?= adminPost('order_update', ['id' => $order['id'], 'order' => $order['id']]) ?><select name="status" class="w-full mt-6 appearance-none border border-gray-100 px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-700 bg-gray-50"><?php foreach ($statusChoices as $choice): ?><option value="<?= $choice ?>" <?= $order['status'] === $choice ? 'selected' : '' ?>><?= escape(statusLabel($choice)) ?></option><?php endforeach; ?></select><button class="mt-4 w-full inline-flex items-center justify-center px-8 py-5 bg-luxe-black text-primary hover:bg-primary hover:text-luxe-black text-[10px] font-bold uppercase tracking-[0.4em] transition-all shadow-lg" type="submit">✓ Պահպանել</button></form>
                    <?php if ($order['payment_method'] !== 'cash'): ?><?= adminPost('order_paid', ['id' => $order['id'], 'value' => $order['is_paid'] ? '0' : '1', 'order' => $order['id']]) ?><button class="mt-4 w-full px-6 py-4 text-[10px] font-bold uppercase tracking-widest border <?= $order['is_paid'] ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100' ?>" type="submit"><?= $order['is_paid'] ? 'Վճարված' : 'Չվճարված' ?></button></form><?php endif; ?>
                </div>
                <a href="content.php?view=orders" class="flex items-center justify-center px-8 py-5 border border-gray-200 text-gray-400 font-bold hover:text-primary hover:border-primary uppercase tracking-[0.3em] text-[10px]">← Պատվերների ցանկ</a>
                <?= adminPost('order_delete', ['id' => $order['id']]) ?><button class="w-full flex items-center justify-center px-8 py-4 border border-red-100 text-red-400 hover:bg-red-50 text-[9px] font-bold uppercase tracking-[0.3em]" type="submit" onclick="return confirm('Ջնջե՞լ պատվերը։')">Ջնջել Պատվերը</button></form>
            </div>
        </div>
        <?php
        adminFooter();
        exit;
    }
    $page = max(1, (int) ($_GET['page'] ?? 1)); $size = 15;
    $search = trim((string) ($_GET['search'] ?? ''));
    $statusFilter = trim((string) ($_GET['status'] ?? ''));
    $statusChoices = ['new', 'confirmed', 'ready', 'delivered', 'cancelled'];
    if (!in_array($statusFilter, $statusChoices, true)) $statusFilter = '';
    $where = []; $types = ''; $values = [];
    if ($search !== '') {
        $where[] = '(full_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
        $term = '%' . $search . '%'; $types .= 'sss'; array_push($values, $term, $term, $term);
    }
    if ($statusFilter !== '') { $where[] = 'status = ?'; $types .= 's'; $values[] = $statusFilter; }
    $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
    $total = (int) adminQuery('SELECT COUNT(*) AS n FROM orders' . $whereSql, $types, $values)->fetch_assoc()['n'];
    $pages = max(1, (int) ceil($total / $size));
    $page = min($page, $pages); $offset = ($page - 1) * $size;
    $queryTypes = $types . 'ii'; $queryValues = array_merge($values, [$size, $offset]);
    $orders = adminQuery('SELECT id, full_name, email, phone, delivery_type, payment_method, total, status, is_paid, created_at FROM orders' . $whereSql . ' ORDER BY created_at DESC LIMIT ? OFFSET ?', $queryTypes, $queryValues)->fetch_all(MYSQLI_ASSOC);
    $newOrders = (int) adminQuery("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'")->fetch_assoc()['n'];
    $orderQuery = static function (int $number) use ($search, $statusFilter): string {
        return 'content.php?view=orders&page=' . $number . ($search !== '' ? '&search=' . rawurlencode($search) : '') . ($statusFilter !== '' ? '&status=' . rawurlencode($statusFilter) : '');
    };
    $deliveryLabel = static fn (string $value): string => $value === 'delivery' ? 'Առաքում' : 'Սրահից';
    $paymentLabel = static fn (string $value): string => ['cash' => 'Կանխիկ', 'card' => 'Քարտ', 'idram' => 'Idram'][$value] ?? $value;
    $statusClass = static fn (string $value): string => [
        'new' => 'bg-orange-50 text-orange-600 border-orange-100',
        'confirmed' => 'bg-blue-50 text-blue-600 border-blue-100',
        'ready' => 'bg-yellow-50 text-yellow-600 border-yellow-100',
        'delivered' => 'bg-green-50 text-green-600 border-green-100',
        'cancelled' => 'bg-red-50 text-red-600 border-red-100',
    ][$value] ?? 'bg-gray-50 text-gray-400 border-gray-100';
    ?>
    <div class="bg-white rounded-none border border-gray-200 shadow-sm p-4 sm:p-6 mb-6"><form class="flex flex-col sm:flex-row gap-3" method="get">
        <input type="hidden" name="view" value="orders">
        <input class="flex-1 border border-gray-200 rounded-none px-4 py-3 text-[10px] uppercase tracking-widest font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary" name="search" value="<?= escape($search) ?>" placeholder="Որոնել անունով կամ հեռախոսով...">
        <select class="border border-gray-200 rounded-none px-4 py-3 text-[10px] uppercase tracking-widest font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white" name="status"><option value="">Բոլորը</option><?php foreach ($statusChoices as $choice): ?><option value="<?= $choice ?>" <?= $statusFilter === $choice ? 'selected' : '' ?>><?= escape(statusLabel($choice)) ?></option><?php endforeach; ?></select>
        <button class="inline-flex items-center justify-center gap-2 px-8 py-3 bg-luxe-black text-primary hover:bg-primary hover:text-luxe-black rounded-none text-[10px] uppercase tracking-[0.3em] font-bold transition-all shadow-lg" type="submit">⌕ Որոնել</button>
        <?php if ($search !== '' || $statusFilter !== ''): ?><a class="inline-flex items-center justify-center px-8 py-3 border border-gray-200 text-gray-400 rounded-none text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-gray-50 transition-all" href="content.php?view=orders">Մաքրել</a><?php endif; ?>
    </form></div>
    <div class="bg-white rounded-none border border-gray-200 shadow-sm overflow-hidden"><div class="p-6 border-b border-gray-100 flex items-center justify-between"><h3 class="text-sm font-heading font-normal uppercase tracking-widest text-gray-900">Պատվերների Ցանկ <?php if ($newOrders): ?><span class="ml-2 text-[9px] font-bold bg-primary text-luxe-black px-2 py-0.5 uppercase tracking-widest"><?= $newOrders ?> նոր</span><?php endif; ?></h3><span class="text-[10px] text-gray-400 uppercase tracking-widest font-bold"><?= $total ?> ընդամենը</span></div>
    <div class="block lg:hidden divide-y divide-gray-50">    <?php foreach ($orders as $order): ?><div class="p-4 space-y-4 bg-white hover:bg-gray-50 transition-colors"><div class="flex justify-between items-start"><div class="space-y-1"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em]">#<?= (int) $order['id'] ?></span><h4 class="font-heading font-normal text-gray-900 text-base uppercase tracking-wide"><?= escape((string) $order['full_name']) ?></h4><a href="tel:<?= escape((string) $order['phone']) ?>" class="text-[11px] text-primary font-bold tracking-widest"><?= escape((string) $order['phone']) ?></a></div><div class="text-right"><p class="font-heading font-normal text-gray-900 text-lg tabular-nums"><?= number_format((float) $order['total']) ?> <span class="text-[9px] text-gray-400 uppercase">AMD</span></p><span class="text-[9px] text-gray-300 uppercase tracking-widest font-bold"><?= escape(substr((string) $order['created_at'], 0, 16)) ?></span></div></div><div class="flex items-center justify-between gap-3 pt-2"><div class="flex items-center gap-2"><span class="px-2 py-1 text-[8px] font-bold uppercase tracking-widest border <?= $order['delivery_type'] === 'delivery' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-400 border-gray-100' ?>"><?= escape($deliveryLabel((string) $order['delivery_type'])) ?></span><span class="px-2 py-1 bg-primary/10 text-primary text-[8px] font-bold uppercase tracking-widest border border-primary/20"><?= escape($paymentLabel((string) $order['payment_method'])) ?></span></div><a href="order-detail.php?id=<?= (int) $order['id'] ?>" class="w-10 h-10 bg-luxe-black text-primary flex items-center justify-center hover:bg-primary hover:text-luxe-black transition-all shadow-md">›</a></div></div><?php endforeach; ?><?php if (!$orders): ?><div class="p-20 text-center"><p class="text-[10px] text-gray-300 uppercase tracking-[0.3em] font-bold">Պատվերներ չկան</p></div><?php endif; ?></div>
    <div class="hidden lg:block overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50 border-b border-gray-100"><tr><th class="text-left px-8 py-5 text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">ID</th><th class="text-left px-8 py-5 text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">Հաճախորդ</th><th class="text-left px-8 py-5 text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">Եղանակ</th><th class="text-left px-8 py-5 text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">Վճարում</th><th class="text-left px-8 py-5 text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">Վճարված</th><th class="text-left px-8 py-5 text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">Գումար</th><th class="text-left px-8 py-5 text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">Կարգավիճակ</th><th class="text-left px-8 py-5 text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">Ամսաթիվ</th><th></th></tr></thead><tbody class="divide-y divide-gray-50">
    <?php foreach ($orders as $order): ?><tr class="hover:bg-gray-50/50 transition-colors group"><td class="px-8 py-6"><span class="text-[10px] font-bold text-gray-300 uppercase tracking-widest">#<?= (int) $order['id'] ?></span></td><td class="px-8 py-6"><div class="flex items-center gap-4"><div class="w-10 h-10 bg-gray-50 border border-gray-100 flex items-center justify-center text-primary font-bold text-sm"><?= escape(mb_strtoupper(mb_substr((string) $order['full_name'], 0, 1))) ?></div><div><h4 class="font-heading font-normal text-gray-900 text-base uppercase tracking-wide leading-none mb-1"><?= escape((string) $order['full_name']) ?></h4><a href="tel:<?= escape((string) $order['phone']) ?>" class="text-[10px] text-gray-400 font-bold tracking-widest hover:text-primary transition-colors"><?= escape((string) $order['phone']) ?></a></div></div></td><td class="px-8 py-6"><span class="text-[10px] <?= $order['delivery_type'] === 'delivery' ? 'text-blue-500' : 'text-gray-400' ?> font-bold uppercase tracking-widest"><?= escape($deliveryLabel((string) $order['delivery_type'])) ?></span></td><td class="px-8 py-6"><span class="text-[9px] font-bold uppercase tracking-widest text-gray-400"><?= escape($paymentLabel((string) $order['payment_method'])) ?></span></td><td class="px-8 py-6"><?php if ($order['payment_method'] !== 'cash'): ?><?= adminPost('order_paid', ['id' => $order['id'], 'value' => $order['is_paid'] ? '0' : '1']) ?><button class="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border <?= $order['is_paid'] ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100' ?>" type="submit"><?= $order['is_paid'] ? 'Վճարված' : 'Չվճարված' ?></button></form><?php endif; ?></td><td class="px-8 py-6"><span class="font-heading font-normal text-primary text-xl tabular-nums"><?= number_format((float) $order['total']) ?> <span class="text-[9px] text-gray-400 uppercase ml-1">AMD</span></span></td><td class="px-8 py-6"><?= adminPost('order_update', ['id' => $order['id']]) ?><select name="status" onchange="this.form.submit()" class="text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-2 border border-gray-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary <?= $statusClass((string) $order['status']) ?>"><?php foreach ($statusChoices as $choice): ?><option value="<?= $choice ?>" <?= $order['status'] === $choice ? 'selected' : '' ?>><?= escape(statusLabel($choice)) ?></option><?php endforeach; ?></select></form></td><td class="px-8 py-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest"><?= escape(substr((string) $order['created_at'], 0, 16)) ?></td><td class="px-8 py-6 text-right"><a href="order-detail.php?id=<?= (int) $order['id'] ?>" class="inline-flex items-center gap-2 text-[10px] text-luxe-black hover:text-primary font-bold uppercase tracking-[0.3em] transition-colors">Դիտել <span aria-hidden="true">›</span></a></td></tr><?php endforeach; ?><?php if (!$orders): ?><tr><td colspan="9" class="px-8 py-20 text-center"><p class="text-[10px] text-gray-300 uppercase tracking-[0.3em] font-bold">Պատվերներ չկան</p></td></tr><?php endif; ?></tbody></table></div>
    <?php if ($pages > 1): ?><div class="px-8 py-8 border-t border-gray-100 flex flex-col lg:flex-row items-center justify-between gap-6"><p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ցուցադրված է <?= (($page - 1) * $size) + 1 ?>–<?= min($page * $size, $total) ?> պատվերները (<?= $total ?>-ից)</p><div class="flex gap-2"><?php for ($i = 1; $i <= $pages; $i++): ?><a class="min-w-[2.5rem] h-10 px-3 inline-flex items-center justify-center text-[11px] font-bold uppercase tracking-widest border <?= $i === $page ? 'bg-luxe-black text-primary border-luxe-black' : 'bg-white text-gray-500 border-gray-100 hover:border-primary' ?>" href="<?= escape($orderQuery($i)) ?>"><?= $i ?></a><?php endfor; ?></div></div><?php endif; ?></div>
} elseif ($view === 'bespoke') {
    $page = max(1, (int) ($_GET['page'] ?? 1)); $size = 15;
    $search = trim((string) ($_GET['search'] ?? ''));
    $statusFilter = (string) ($_GET['status'] ?? '');
    $statusChoices = ['new', 'contacted', 'in_progress', 'completed', 'cancelled'];
    $where = []; $types = ''; $values = [];
    if ($search !== '') { $where[] = '(full_name LIKE ? OR phone LIKE ? OR email LIKE ?)'; $term = '%' . $search . '%'; $types = 'sss'; $values = [$term, $term, $term]; }
    if (in_array($statusFilter, $statusChoices, true)) { $where[] = 'status = ?'; $types .= 's'; $values[] = $statusFilter; }
    $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
    $total = (int) adminQuery('SELECT COUNT(*) AS n FROM bespoke_orders' . $whereSql, $types, $values)->fetch_assoc()['n'];
    $pages = max(1, (int) ceil($total / $size)); $page = min($page, $pages); $offset = ($page - 1) * $size;
    $orders = adminQuery('SELECT * FROM bespoke_orders' . $whereSql . ' ORDER BY created_at DESC LIMIT ? OFFSET ?', $types . 'ii', [...$values, $size, $offset])->fetch_all(MYSQLI_ASSOC);
    $jewelryLabels = ['ring' => 'Մատանի', 'necklace' => 'Վզնոց', 'earrings' => 'Ականջօղ', 'bracelet' => 'Ապարանջան', 'other' => 'Այլ'];
    $statusLabels = ['new' => 'Նոր', 'contacted' => 'Կապ', 'in_progress' => 'Ընթացք', 'completed' => 'Ավարտված', 'cancelled' => 'Չեղարկված'];
    $statusClasses = ['new' => 'bg-blue-50 text-blue-500 border-blue-100', 'contacted' => 'bg-amber-50 text-amber-500 border-amber-100', 'in_progress' => 'bg-purple-50 text-purple-500 border-purple-100', 'completed' => 'bg-emerald-50 text-emerald-500 border-emerald-100', 'cancelled' => 'bg-gray-50 text-gray-400 border-gray-100'];
    $bespokeQuery = static function (int $number) use ($search, $statusFilter): string {
        return 'content.php?view=bespoke&page=' . $number . ($search !== '' ? '&search=' . rawurlencode($search) : '') . ($statusFilter !== '' ? '&status=' . rawurlencode($statusFilter) : '');
    };
    ?>
    <div class="mb-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"><div class="flex flex-wrap gap-2"><?php $filters = ['' => 'Բոլորը', 'new' => 'Նոր', 'contacted' => 'Կապ', 'in_progress' => 'Ընթացք', 'completed' => 'Ավարտված', 'cancelled' => 'Չեղարկված']; foreach ($filters as $value => $label): ?><a href="<?= escape($bespokeQuery(1) . ($value === '' ? '' : '&status=' . rawurlencode($value))) ?>" class="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border <?= $statusFilter === $value ? 'bg-luxe-black text-primary border-luxe-black' : 'border-gray-200 text-gray-400 hover:border-primary hover:text-primary' ?> transition-all"><?= escape($label) ?></a><?php endforeach; ?></div><form class="w-full sm:w-auto relative" method="get"><input type="hidden" name="view" value="bespoke"><input type="hidden" name="status" value="<?= escape($statusFilter) ?>"><input type="text" name="search" value="<?= escape($search) ?>" placeholder="Փնտրել..." class="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-200 text-[10px] font-bold uppercase tracking-widest focus:border-primary outline-none transition-all"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">⌕</span></form></div>
    <div class="bg-white border border-gray-200 shadow-sm overflow-hidden"><div class="hidden lg:block"><table class="w-full text-left border-collapse"><thead><tr class="bg-gray-50 border-b border-gray-100"><th class="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Հայտ #</th><th class="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Հաճախորդ</th><th class="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Տեսակ</th><th class="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Բյուջե</th><th class="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Կարգավիճակ</th><th class="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Ամսաթիվ</th><th></th></tr></thead><tbody class="divide-y divide-gray-50"><?php foreach ($orders as $order): ?><tr class="hover:bg-gray-50/50 transition-colors group"><td class="px-6 py-4 text-xs font-bold text-gray-900 tracking-wider">#<?= (int) $order['id'] ?></td><td class="px-6 py-4"><div class="text-xs font-bold text-gray-900 mb-0.5"><?= escape((string) $order['full_name']) ?></div><div class="text-[10px] text-gray-400 font-medium"><?= escape((string) $order['phone']) ?></div></td><td class="px-6 py-4"><span class="text-[10px] font-bold text-gray-600 uppercase tracking-widest"><?= escape($jewelryLabels[$order['jewelry_type']] ?? (string) $order['jewelry_type']) ?></span></td><td class="px-6 py-4 text-xs font-bold text-gray-900"><?= escape((string) ($order['budget_range'] ?? '')) ?></td><td class="px-6 py-4"><span class="px-2 py-1 <?= $statusClasses[$order['status']] ?? $statusClasses['cancelled'] ?> text-[8px] font-bold uppercase tracking-widest border"><?= escape($statusLabels[$order['status']] ?? (string) $order['status']) ?></span></td><td class="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter"><?= escape(substr((string) $order['created_at'], 0, 10)) ?></td><td class="px-6 py-4 text-right"><a href="bespoke-detail.php?id=<?= (int) $order['id'] ?>" class="inline-flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[9px] hover:underline">Դիտել <span aria-hidden="true">›</span></a></td></tr><?php endforeach; ?></tbody></table></div>
    <div class="lg:hidden divide-y divide-gray-100"><?php foreach ($orders as $order): ?><div class="p-6 hover:bg-gray-50 transition-colors"><div class="flex justify-between items-start mb-4"><div><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">#<?= (int) $order['id'] ?></span><h4 class="text-xs font-bold text-gray-900 mt-1 uppercase tracking-wide"><?= escape((string) $order['full_name']) ?></h4></div><?php if (in_array($order['status'], ['new', 'completed'], true)): ?><span class="px-2 py-0.5 <?= $statusClasses[$order['status']] ?> text-[8px] font-bold uppercase tracking-widest border"><?= escape($statusLabels[$order['status']]) ?></span><?php endif; ?></div><div class="grid grid-cols-2 gap-4 mb-6"><div><p class="text-[8px] font-bold text-gray-300 uppercase tracking-widest mb-1">Տեսակ</p><p class="text-[10px] font-bold text-gray-600 uppercase"><?= escape($jewelryLabels[$order['jewelry_type']] ?? (string) $order['jewelry_type']) ?></p></div><div><p class="text-[8px] font-bold text-gray-300 uppercase tracking-widest mb-1">Բյուջե</p><p class="text-[10px] font-bold text-gray-900"><?= escape((string) ($order['budget_range'] ?? '')) ?></p></div></div><a href="bespoke-detail.php?id=<?= (int) $order['id'] ?>" class="block w-full py-3 bg-gray-50 border border-gray-100 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-primary hover:border-primary transition-all">Մանրամասն</a></div><?php endforeach; ?><?php if (!$orders): ?><div class="p-20 text-center"><p class="text-[10px] text-gray-300 uppercase tracking-[0.3em] font-bold">Հայտեր չեն գտնվել</p></div><?php endif; ?></div></div>
    <?php if ($pages > 1): ?><div class="flex gap-2 flex-wrap mt-6"><?php for ($i = 1; $i <= $pages; $i++): ?><a class="admin-button <?= $i === $page ? 'dark' : '' ?>" href="<?= escape($bespokeQuery($i)) ?>"><?= $i ?></a><?php endfor; ?></div><?php endif;
} elseif ($view === 'reviews') {
    $search = trim((string) ($_GET['search'] ?? ''));
    $ratingFilter = (int) ($_GET['rating'] ?? 0);
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $size = 10;
    $where = []; $types = ''; $values = [];
    if ($search !== '') { $where[] = '(name LIKE ? OR text LIKE ?)'; $term = '%' . $search . '%'; $types = 'ss'; $values = [$term, $term]; }
    if ($ratingFilter >= 1 && $ratingFilter <= 5) { $where[] = 'rating = ?'; $types .= 'i'; $values[] = $ratingFilter; }
    $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
    $total = (int) adminQuery('SELECT COUNT(*) AS n FROM reviews' . $whereSql, $types, $values)->fetch_assoc()['n'];
    $pages = max(1, (int) ceil($total / $size));
    $page = min($page, $pages);
    $offset = ($page - 1) * $size;
    $reviews = adminQuery('SELECT * FROM reviews' . $whereSql . ' ORDER BY created_at DESC LIMIT ? OFFSET ?', $types . 'ii', [...$values, $size, $offset])->fetch_all(MYSQLI_ASSOC);
    ?>
    <div class="bg-white rounded-none border border-gray-200 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
            <form class="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1 w-full" method="get">
                <input type="hidden" name="view" value="reviews">
                <div class="relative flex-1"><span class="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400">⌕</span><input name="search" value="<?= escape($search) ?>" placeholder="Փնտրել անունով, կարծիքով..." class="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-primary text-sm"></div>
                <select name="rating" class="px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-primary text-sm"><option value="">Բոլոր վարկանիշները</option><?php foreach ([5,4,3,2,1] as $n): ?><option value="<?= $n ?>" <?= $ratingFilter === $n ? 'selected' : '' ?>><?= $n ?> աստղ</option><?php endforeach; ?></select>
                <button class="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-none text-sm" type="submit">Ֆիլտրել</button>
            </form>
            <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto"><button class="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-white border border-gray-300 text-gray-700 font-semibold text-sm" type="button" disabled>↻ <span class="hidden sm:inline">Սինք Google-ից</span><span class="sm:hidden">Սինք</span></button><button class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-luxe-black font-semibold text-sm" type="button" disabled>＋ Ավելացնել կարծիք</button></div>
        </div>
    </div>
    <?php if ($reviews): ?><div class="space-y-3 sm:space-y-4 mb-4 sm:mb-6"><?php foreach ($reviews as $review): ?>
        <div class="bg-white rounded-none border border-gray-200 shadow-sm hover:shadow-lg transition-all p-4 sm:p-6"><div class="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div class="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full"><div class="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/20 flex items-center justify-center"><span class="text-primary font-bold text-lg sm:text-xl"><?= escape(mb_strtoupper(mb_substr((string) $review['name'], 0, 1))) ?></span></div><div class="flex-1 min-w-0">
                <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1"><h3 class="font-heading font-bold text-gray-900 truncate text-sm sm:text-base"><?= escape((string) $review['name']) ?></h3><div class="text-yellow-500 text-sm"><?= str_repeat('★', max(0, min(5, (int) $review['rating']))) ?></div></div>
                <div class="mb-2"><span class="inline-flex items-center px-2 py-0.5 text-xs font-medium <?= $review['is_approved'] ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800' ?>"><?= $review['is_approved'] ? 'Հաստատված' : 'Սպասում է' ?></span></div>
                <?php if (!empty($review['badge'])): ?><p class="text-xs sm:text-sm text-gray-500 mb-2"><?= escape((string) $review['badge']) ?></p><?php endif; ?><p class="text-sm sm:text-base text-gray-700 leading-relaxed break-words"><?= escape((string) $review['text']) ?></p><?php if (!empty($review['time'])): ?><p class="text-xs text-gray-400 mt-2"><?= escape((string) $review['time']) ?></p><?php endif; ?>
            </div></div>
            <div class="flex sm:flex-col gap-2 ml-auto sm:ml-0"><?= adminPost('review_toggle', ['id' => $review['id'], 'value' => $review['is_approved'] ? '0' : '1']) ?><button class="p-2 bg-blue-50 text-blue-700 text-xs" type="submit" title="Հաստատել">✓</button></form><?= adminPost('review_delete', ['id' => $review['id']]) ?><button class="p-2 bg-red-50 text-red-700 text-xs" type="submit" title="Ջնջել">×</button></form></div>
        </div><div class="flex flex-wrap items-center gap-2 sm:gap-4 pt-3 sm:pt-4 mt-3 border-t border-gray-100 text-xs text-gray-500">Ստեղծվել է։ <?= escape(substr((string) $review['created_at'], 0, 10)) ?></div></div>
    <?php endforeach; ?></div><?php else: ?><div class="bg-white rounded-none border border-gray-200 p-8 sm:p-12 text-center"><div class="text-5xl text-gray-300 mb-4">☆</div><h3 class="text-lg sm:text-xl font-heading font-bold text-gray-900 mb-2">Կարծիքներ չեն գտնվել</h3><p class="text-sm sm:text-base text-gray-600">Փորձեք փոխել ֆիլտրները կամ ավելացնել նոր կարծիք</p></div><?php endif; ?>
    <?php if ($pages > 1): ?><div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 sm:mt-6"><p class="text-xs sm:text-sm text-gray-500 font-medium">Ցուցադրված է <?= ($offset + 1) ?>–<?= min($offset + count($reviews), $total) ?> կարծիքները (<?= $total ?>-ից)</p><div class="flex gap-2"><?php for ($i = 1; $i <= $pages; $i++): ?><a class="admin-button <?= $i === $page ? 'dark' : '' ?>" href="content.php?view=reviews&page=<?= $i ?>&search=<?= rawurlencode($search) ?>&rating=<?= $ratingFilter ?>"><?= $i ?></a><?php endfor; ?></div></div><?php endif; ?>
    <?php
} elseif ($view === 'messages') {
    $page = max(1, (int) ($_GET['page'] ?? 1)); $size = 15; $offset = ($page - 1) * $size;
    $total = (int) adminQuery('SELECT COUNT(*) AS n FROM contact_messages')->fetch_assoc()['n'];
    $pages = max(1, (int) ceil($total / $size)); $page = min($page, $pages); $offset = ($page - 1) * $size;
    $messages = adminQuery('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ? OFFSET ?', 'ii', [$size, $offset])->fetch_all(MYSQLI_ASSOC);
    ?>
    <div class="space-y-6">
    <?php foreach ($messages as $message): ?><div class="bg-white rounded-none border border-gray-200 shadow-sm hover:shadow-xl transition-all p-6 sm:p-10 group"><div class="flex items-start gap-6 sm:gap-8"><div class="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 bg-gray-50 border border-gray-100 flex items-center justify-center text-primary font-heading text-2xl group-hover:bg-primary group-hover:text-luxe-black transition-colors"><?= escape(mb_strtoupper(mb_substr((string) $message['name'], 0, 1))) ?></div><div class="flex-1 min-w-0"><div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6"><div class="min-w-0"><h3 class="font-heading font-normal text-gray-900 text-xl sm:text-2xl uppercase tracking-wide break-words leading-none mb-3"><?= escape((string) $message['name']) ?></h3><div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest"><a href="mailto:<?= escape((string) $message['email']) ?>" class="inline-flex items-center gap-1.5 break-all text-gray-400 hover:text-primary">✉ <?= escape((string) $message['email']) ?></a><?php if (!empty($message['phone'])): ?><span class="hidden sm:inline text-gray-200">•</span><a href="tel:<?= escape((string) $message['phone']) ?>" class="inline-flex items-center gap-1.5 break-all text-gray-400 hover:text-primary">☎ <?= escape((string) $message['phone']) ?></a><?php endif; ?></div></div><div class="flex justify-between items-center gap-6"><span class="text-[10px] font-bold text-gray-300 uppercase tracking-widest"><?= escape(substr((string) $message['created_at'], 0, 16)) ?></span><?= adminPost('message_delete', ['id' => $message['id']]) ?><button class="text-red-400 hover:text-red-600 text-[10px] font-bold uppercase tracking-[0.3em] transition-colors" type="submit">Ջնջել</button></form></div></div><div class="bg-gray-50 border-l-4 border-primary p-6 sm:p-8"><p class="text-gray-700 font-heading font-normal text-lg sm:text-xl leading-relaxed whitespace-pre-wrap break-words">"<?= escape((string) $message['message']) ?>"</p></div></div></div></div><?php endforeach; ?>
    <?php if (!$messages): ?><div class="bg-white rounded-none border border-gray-100 p-20 text-center"><div class="text-gray-100 text-6xl mb-8">✉</div><h3 class="text-xl font-heading font-normal text-gray-900 uppercase tracking-widest mb-2">Հաղորդագրություններ չկան</h3><p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">Դեռ հաղորդագրություններ չեն ստացվել</p></div><?php endif; ?>
    </div>
    <?php if ($pages > 1): ?><div class="bg-white rounded-none border border-gray-200 shadow-sm p-8 mt-10"><div class="flex flex-col lg:flex-row items-center justify-between gap-6"><p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ցուցադրվում է <span class="text-gray-900"><?= (($page - 1) * $size) + 1 ?></span> - <span class="text-gray-900"><?= min($page * $size, $total) ?></span>՝ ընդհանուր <span class="text-gray-900"><?= $total ?></span></p><div class="flex gap-2"><?php for ($i = 1; $i <= $pages; $i++): ?><a class="min-w-[2.5rem] h-10 px-3 inline-flex items-center justify-center text-[11px] font-bold uppercase tracking-widest border <?= $i === $page ? 'bg-luxe-black text-primary border-luxe-black' : 'bg-white text-gray-500 border-gray-100 hover:border-primary' ?>" href="content.php?view=messages&page=<?= $i ?>"><?= $i ?></a><?php endfor; ?></div></div></div><?php endif; ?>
    <?php
} elseif ($view === 'users') {
    $users = adminQuery('SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC')->fetch_all(MYSQLI_ASSOC);
    ?>
    <div class="page-heading"><div><p class="eyebrow">ՀԱՇԻՎՆԵՐ</p><h1>Օգտատերեր</h1><p class="heading-copy">Կառավարեք ադմինների և հաճախորդների հաշիվները</p></div></div>
    <section class="admin-card p-6 mb-6"><form method="post" action="actions.php" class="grid grid-cols-1 md:grid-cols-4 gap-4"><input type="hidden" name="csrf_token" value="<?= escape($_SESSION['csrf_token']) ?>"><input type="hidden" name="action" value="user_create"><input class="admin-input" name="username" placeholder="Մուտքանուն" required><input class="admin-input" name="email" type="email" placeholder="Էլ. հասցե" required><input class="admin-input" name="password" type="password" placeholder="Գաղտնաբառ" required><button class="admin-button" type="submit">Ավելացնել</button></form></section>
    <div class="admin-card overflow-x-auto"><table class="admin-table"><thead><tr><th>Մուտքանուն</th><th>Էլ. հասցե</th><th>Դեր</th><th>Ակտիվ</th><th>Գործողություն</th></tr></thead><tbody><?php foreach ($users as $user): ?><tr><td><?= escape((string) $user['username']) ?></td><td><?= escape((string) $user['email']) ?></td><td><?= adminPost('user_role', ['id' => $user['id'], 'role' => $user['role'] === 'admin' ? 'customer' : 'admin']) ?><button class="admin-button dark" type="submit"><?= escape((string) $user['role']) ?></button></form></td><td><?= adminPost('user_active', ['id' => $user['id'], 'value' => $user['is_active'] ? '0' : '1']) ?><button class="admin-button" type="submit"><?= $user['is_active'] ? 'Ակտիվ' : 'Պասիվ' ?></button></form></td><td><?= adminPost('user_delete', ['id' => $user['id']]) ?><button class="admin-button danger" type="submit">Ջնջել</button></form></td></tr><?php endforeach; ?></tbody></table></div>
    <?php
}
adminFooter();
