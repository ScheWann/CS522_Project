#!/bin/sh

##parameters
chrlensfile="../Data/chromosome_sizes.txt"
res=5000
threads=20
EXE_PATH="../sBIF/bin/sBIF"


for interfile in ../Data/folding_input/*.txt; do

    filename=$(basename "$interfile")
    
    # Extract the chromosome (job_prefix) from the filename
    chrom=$(echo "$filename" | cut -d'.' -f1)
    job_prefix="$chrom"

    start=$(echo "$filename" | cut -d'.' -f2)
    end=$(echo "$filename" | cut -d'.' -f3 | sed 's/.txt//')

    ##command
    cmd="$EXE_PATH -i $interfile -c $chrom -l $chrlensfile -s $start -e $end -r $res -j $job_prefix -p $threads"
    
    echo "Running command: $cmd"
    
    $cmd 
done

echo "Done."