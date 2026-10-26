SELECT
    md.dispensing_id,
    md.prescription_item_id,
    m.medicine_name,
    md.quantity_dispensed,
    md.dispensed_by,
    md.dispensed_at
FROM medicine_dispensing md
JOIN prescription_items pi
    ON pi.prescription_item_id = md.prescription_item_id
JOIN medicines m
    ON m.medicine_id = pi.medicine_id
ORDER BY md.dispensing_id DESC;