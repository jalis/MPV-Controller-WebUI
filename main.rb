require 'win32/pipe'
require 'json'
require 'sinatra/base'

include Win32

$media_folder="D:/Anime"

mpv_path=';D:\Tools\MPV'
$pipe_name='mpvsocket'

temp_path=ENV['PATH'].dup
temp_path << mpv_path

mpv_pid=0

if File.exists?(File.join("\\\\.\\pipe\\",$pipe_name))
    puts "The pipe is already taken, either there's another MPV WebUI Controller running, or a ghost MPV process"
    return
end

mpv_pid=Process.spawn({'PATH' => temp_path, 'MPV_HOME'=>'.'}, "mpv.exe")

sleep 0.1 until File.exists?(File.join("\\\\.\\pipe\\",$pipe_name))


$running=true

def check_folder(path)
    files=Array.new
    Dir.foreach(path) do |item|
        next if item == '.' or item == '..' or item == 'desktop.ini'

        if File.directory?(File.join(path, item))
            files.push({:type => 1, :folder_path => item, :data => check_folder(File.join(path,item))})
        else
            files.push({:type => 0, :folder_path => path, :data => item})
        end
    end
    return files;
end

sinatra_thread = Thread.new() do
    class MPVMediaServer < Sinatra::Base
        set :bind, '0.0.0.0'
        set :port, 80
#        set :server, 'thin'

        puts "Sinatra running in thread: #{Thread.current}"

        @@playlist_update_key=0;
        @@media=Array.new;

        @@media=check_folder($media_folder)

        class << self
            attr_reader :sinatra_thread
        end

        def send_command(cmd, *args)
            json_cmd={"command" => [cmd, args].flatten}.to_json

            out=""
            Pipe::Client.new($pipe_name, Pipe::ACCESS_DUPLEX, Pipe::NOWAIT, ) do |pipe|
                pipe.write(json_cmd)
                pipe.write("\n")

                loop do
                    out << pipe.read
                    break if out[-1].ord==10
                end
            end
            return out
        end

        get '/' do
            @playlist=JSON.parse(send_command("get_property", "playlist"))['data']
            @title=JSON.parse(send_command("get_property", "media-title"))["data"]
            @duration=JSON.parse(send_command("get_property", "duration"))["data"]
            @position=JSON.parse(send_command("get_property", "time-pos"))["data"]
            @paused=JSON.parse(send_command("get_property", "pause"))["data"]
            @idle=JSON.parse(send_command("get_property", "core-idle"))["data"]
            @playlist_update_key=@@playlist_update_key
            @media=@@media

            erb :index
        end

        get '/update' do
            update_data=Array.new
            update_data.push JSON.parse(send_command("get_property", "media-title"))["data"]
            update_data.push JSON.parse(send_command("get_property", "duration"))["data"]
            update_data.push JSON.parse(send_command("get_property", "time-pos"))["data"]
            update_data.push JSON.parse(send_command("get_property", "playlist-pos"))["data"]
            update_data.push JSON.parse(send_command("get_property", "pause"))["data"]
            update_data.push JSON.parse(send_command("get_property", "core-idle"))["data"]
            update_data.push @@playlist_update_key;

            update_data.to_json
        end

        get'/seek/:pos' do
            pos=params['pos']

            send_command("seek", pos, "absolute");
        end

        get '/test' do
            send_command("show-text", "Testing command", 5000)
        end

        get '/property/:prop' do
            prop=params['prop']

            send_command("get_property", prop)
        end

        get '/set-playlist/:id' do
            id=params['id']

            @@playlist_update_key=@@playlist_update_key+1
            send_command("set_property", "playlist-pos", id)
        end

        get '/del-playlist/:id' do
            id=params['id']

            @@playlist_update_key=@@playlist_update_key+1
            send_command("playlist-remove", id)
        end

        get '/formatted-playlist' do
            @playlist=JSON.parse(send_command("get_property", "playlist"))['data']

            [erb(:playlist, :layout => false), @@playlist_update_key].to_json
        end

        get '/play' do
            file=params['file']

            @@playlist_update_key=@@playlist_update_key+1
            send_command("loadfile", file, "append-play")
        end

        get '/next' do
            @@playlist_update_key=@@playlist_update_key+1
            send_command("playlist-next")
        end

        get '/prev' do
            @@playlist_update_key=@@playlist_update_key+1
            send_command("playlist-prev")
        end

        get '/cycle/:prop' do
            prop=params['prop']

            send_command("cycle", prop)
        end
        
        get '/volume/:vol' do
            vol=params['vol']

            send_command("set_property", "ao-volume", vol)
        end

        get '/exit' do
            running=false
            exit!(0)
        end

        run!
    end
end


sinatra_thread.join
Process.kill 9, mpv_pid unless mpv_pid==0