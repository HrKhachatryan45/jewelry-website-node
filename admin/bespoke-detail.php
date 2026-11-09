<?php
declare(strict_types=1);
require_once __DIR__ . '/common.php';

$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
if ($id === false || $id < 1) {
    http_response_code(404);
    exit('Հայտը չի գտնվել։');
}
$statement = $mysqli->prepare('SELECT * FROM bespoke_orders WHERE id = ? LIMIT 1');
$statement->bind_param('i', $id);
$statement->execute();
$order = $statement->get_result()->fetch_assoc();
if (!$order) {
    http_response_code(404);
    exit('Հայտը չի գտնվել։');
}
$labels = ['ring' => 'Մատանի', 'necklace' => 'Վզնոց', 'earrings' => 'Ականջօղ', 'bracelet' => 'Ապարանջան', 'other' => 'Այլ'];
$statuses = ['new' => 'Նոր', 'contacted' => 'Կապ', 'in_progress' => 'Ընթացք', 'completed' => 'Ավարտված', 'cancelled' => 'Չեղարկված'];
adminHeader('Հայտ #' . $id, 'bespoke');
?>
<div class="max-w-5xl">
    <div class="mb-8"><a href="content.php?view=bespoke" class="inline-flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] hover:text-primary">← Հետ դեպի ցուցակ</a></div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-8">
            <div class="bg-white border border-gray-200 p-8 shadow-sm">
                <div class="flex items-center justify-between mb-10 pb-6 border-b border-gray-100"><h3 class="text-sm font-heading uppercase tracking-widest">Պատվերի Տվյալներ</h3><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest"><?= escape(substr((string) $order['created_at'], 0, 16)) ?></span></div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
                    <div><p class="admin-label">Զարդի տեսակ</p><p class="text-sm font-bold uppercase"><?= escape($labels[$order['jewelry_type']] ?? $order['jewelry_type']) ?></p></div>
                    <div><p class="admin-label">Բյուջեի շրջանակ</p><p class="text-sm font-bold uppercase"><?= escape((string) $order['budget_range']) ?></p></div>
                    <div><p class="admin-label">Վերջնաժամկետ</p><p class="text-sm font-bold uppercase"><?= escape((string) ($order['deadline'] ?: 'Նշված չէ')) ?></p></div>
                </div>
                <div class="mt-12"><p class="admin-label">Քարերի նախընտրություն</p><div class="p-6 bg-gray-50 border border-gray-100 text-sm text-gray-600 italic"><?= escape((string) ($order['gemstone_preferences'] ?: 'Նախընտրություններ չկան')) ?></div></div>
                <div class="mt-12"><p class="admin-label">Լրացուցիչ մանրամասներ</p><div class="p-6 bg-gray-50 border border-gray-100 text-sm text-gray-600 leading-relaxed"><?= escape((string) $order['description']) ?></div></div>
            </div>
            <?php $sketches = array_filter([$order['sketch'], $order['sketch2'], $order['sketch3']]); if ($sketches): ?><div class="bg-white border border-gray-200 p-8 shadow-sm"><h3 class="text-sm font-heading uppercase tracking-widest mb-8">Էսքիզ / Նկար</h3><div class="space-y-4"><?php foreach ($sketches as $sketch): ?><div class="border border-gray-100 overflow-hidden"><img src="<?= escape(str_starts_with((string) $sketch, '/') ? (string) $sketch : '/uploads/' . ltrim((string) $sketch, '/')) ?>" class="w-full h-auto object-cover" alt=""></div><?php endforeach; ?></div></div><?php endif; ?>
        </div>
        <div class="space-y-8">
            <div class="bg-luxe-black p-8 shadow-xl"><h3 class="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-8">Կարգավիճակ</h3><?= adminPost('bespoke_update', ['id' => $id, 'bespoke_detail' => '1']) ?><select name="status" class="w-full bg-white/5 border border-white/10 text-white px-4 py-4 text-[10px] font-bold uppercase tracking-widest"><?php foreach ($statuses as $value => $label): ?><option value="<?= $value ?>" class="bg-luxe-black" <?= $order['status'] === $value ? 'selected' : '' ?>><?= $label ?></option><?php endforeach; ?></select><button class="mt-6 w-full py-4 bg-primary text-luxe-black font-bold uppercase tracking-[0.3em] text-[10px]">Պահպանել</button></form>
                <div class="mt-10 pt-8 border-t border-white/5"><p class="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-4">Հաճախորդի տվյալներ</p><div class="space-y-4"><p class="text-[10px] font-bold text-white uppercase"><?= escape((string) $order['full_name']) ?></p><a href="tel:<?= escape((string) $order['phone']) ?>" class="block text-[10px] font-bold text-white"><?= escape((string) $order['phone']) ?></a><p class="text-[10px] text-white break-all"><?= escape((string) $order['email']) ?></p></div><a href="tel:<?= escape((string) $order['phone']) ?>" class="block mt-10 w-full py-4 bg-primary text-luxe-black text-center font-bold uppercase tracking-[0.4em] text-[10px]">Զանգահարել</a></div>
            </div>
        </div>
    </div>
</div>
<?php adminFooter(); ?>
